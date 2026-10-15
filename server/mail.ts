import { db, rpc } from './db';
import { dateLabel, money } from '../shared/domain';
export function messageFor(kind: string, p: Record<string, any>) {
  const titles: Record<string,string> = { received: 'Otrzymaliśmy zamówienie', owner: 'Nowe zamówienie — skontaktuj się z klientem', accepted: 'Przyjęliśmy zamówienie', deposit: 'Odnotowaliśmy zaliczkę', changed: 'Aktualizacja zamówienia' };
  const head = `${titles[kind] || titles.changed} nr CP-${p.number}`;
  let text = `${head}\n\nPakiet: ${p.package.name}\nCena brutto: ${money(p.package.price)}\nCmentarz: ${p.cemetery.name}, ${p.cemetery.address}\nDzień: ${dateLabel(p.date)}\n`;
  if (kind === 'received') text += '\nTo potwierdzenie odbioru, nie przyjęcia zamówienia. Zadzwonimy, aby potwierdzić realizację. Nie wpłacaj jeszcze zaliczki.\n';
  if (kind === 'accepted') text += `\nPrzyjmujemy zamówienie do realizacji. Zaliczka: ${money(p.package.deposit)}. ${process.env.PAYMENT_INSTRUCTIONS}\nPozostało: ${money(p.package.price-p.package.deposit)}, w ciągu 24 godzin po przesłaniu zdjęć wykonanej usługi.\n`;
  if (kind === 'deposit') text += `\nOdnotowano wpłatę ${money(p.depositReceived)}. Pozostało ${money(p.package.price-p.depositReceived)}.\n`;
  if (kind === 'changed') text += `\nStatus: ${p.status}. Wpłata: ${p.payment}. Zwrócono: ${money(p.depositRefunded || 0)}.\n${p.message || ''}\n`;
  if (kind === 'owner') text += `\n${p.customer.name}\n${p.customer.phone}\n${p.customer.email}\nLokalizacja: ${p.grave.location}\nTablica: ${p.grave.inscription}\nKwatera: ${p.grave.sector}; rząd: ${p.grave.row}; grób: ${p.grave.grave}\nPanel: ${process.env.APP_ORIGIN}/admin\n`;
  else text += `\nZamawiający: ${p.customer.name}\nLokalizacja: ${p.grave.location}\nTablica: ${p.grave.inscription}\nWarunki zamówienia, wersja ${p.documents.version}:\n${Object.entries(p.documents.texts).map(([k,v]) => `${k.toUpperCase()}\n${v}`).join('\n\n')}\n\nOświadczenie: ${p.documents.declarations?.terms || ''}\nŻądanie wcześniejszego rozpoczęcia: ${p.earlyStart ? 'TAK' : 'NIE'}; ${p.documents.declarations?.earlyStart || ''}; utrwalono ${p.acceptedAt}.\n`;
  return { subject: head, text };
}
export async function processOutbox() {
  if (!db || !process.env.RESEND_API_KEY) throw new Error('NOT_READY');
  const jobs = await rpc('claim_outbox'); let sent = 0;
  for (const job of jobs) {
    try {
      const mail = messageFor(job.kind, job.payload);
      const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': job.id }, body: JSON.stringify({ from: process.env.MAIL_FROM, to: [job.recipient], ...mail }), signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`MAIL_HTTP_${response.status}`);
      const result = await response.json() as {id: string};
      const { error } = await db.from('outbox').update({ state: 'sent', provider_id: result.id, last_error: null }).eq('id', job.id);
      if (error) throw new Error('MAIL_STATE_UPDATE');
      sent++;
    } catch (error) {
      await db.from('outbox').update({ state: 'failed', last_error: error instanceof Error ? error.message : 'MAIL_ERROR', next_attempt_at: new Date(Date.now()+Math.min(3600000, 30000 * 2 ** job.attempts)).toISOString() }).eq('id', job.id);
    }
  }
  return { processed: jobs.length, sent };
}
