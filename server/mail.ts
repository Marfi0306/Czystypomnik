import { db, rpc } from './db';
import { dateLabel, money,statusLabels } from '../shared/domain';
import {earlyStartStatement} from '../shared/consent';
const moment=(v:string)=>new Intl.DateTimeFormat('pl-PL',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Warsaw'}).format(new Date(v))+' (Europe/Warsaw)';
const documents=(p:Record<string,any>)=>`Pełne warunki, wersja ${p.version}:\n`+Object.entries(p.texts).map(([key,value])=>`${key.toUpperCase()}\n${value}`).join('\n\n');
export function messageFor(kind:string,p:Record<string,any>){
 const titles:Record<string,string>={received:'Otrzymaliśmy zgłoszenie',owner:'Nowe zgłoszenie — skontaktuj się z klientem',offer:'Oferta do akceptacji',contract:'Potwierdzenie zawarcia umowy',deposit:'Odnotowaliśmy zaliczkę',completed:'Wykonanie i rozliczenie usługi',changed:'Aktualizacja zgłoszenia / usługi'};
 if(!titles[kind])throw new Error('UNSUPPORTED_MAIL_KIND');
 const subject=`Czysty Pomnik — ${titles[kind]} CP-${p.number}`;
 let text=`${subject}\n\nPakiet: ${p.package.name}\nCena brutto: ${money(p.package.price)}\nCmentarz: ${p.cemetery.name}, ${p.cemetery.address}\nDzień: ${dateLabel(p.date)}\n`;
 const company=p.documents.business||{};
 if(kind==='received')text+='\nTo potwierdzenie otrzymania zgłoszenia, a nie zawarcia umowy lub gwarancja terminu. Skontaktujemy się telefonicznie, aby omówić realizację i przesłać ofertę e-mailem do akceptacji. Nie wpłacaj jeszcze zaliczki.\n';
 if(kind==='owner')text+=`\n${p.customer.name}\n${p.customer.phone}\n${p.customer.email}\nLokalizacja: ${p.grave.location}\nTablica: ${p.grave.inscription}\nKwatera: ${p.grave.sector}; rząd: ${p.grave.row}; grób: ${p.grave.grave}\nPanel: ${process.env.APP_ORIGIN}/admin\n`;
 if(kind==='offer'||kind==='contract'){
  const q=p.offer;if(!q?.id||!q.bankAccount||!q.validUntil||!q.depositDue||!q.scope)throw new Error('OFFER_REQUIRED');
  const b=q.documents.business;
  text+=`\nUsługodawca i odbiorca płatności: ${b.name}, ${b.address}; NIP ${b.nip}; KRS ${b.krs}; REGON ${b.regon}; kapitał 5 000 zł; ${b.registryCourt}.\nIdentyfikator oferty: ${q.id}, z dnia ${moment(q.createdAt)}.\nDokładny zakres: ${q.scope}\nLokalizacja: ${q.grave.location}; tablica: ${q.grave.inscription}; kwatera: ${q.grave.sector}; rząd: ${q.grave.row}; grób: ${q.grave.grave}.\nCena brutto obejmująca uzgodnione koszty: ${money(q.package.price)}. Zaliczka będąca częścią ceny: ${money(q.package.deposit)}; płatna po zawarciu umowy do ${moment(q.depositDue)}.\nRachunek SO SOCIAL: ${q.bankAccount}. Tytuł: Czysty Pomnik CP-${p.number}.\nReszta: ${money(q.package.price-q.package.deposit)}, przelewem w ciągu 24 godzin od otrzymania zdjęć i rozliczenia.\nOferta ważna do ${moment(q.validUntil)}.\n`;
  if(kind==='offer')text+=`\nAby zawrzeć umowę, odpowiedz przed upływem ważności oferty: „Akceptuję ofertę Czysty Pomnik CP-${p.number}, identyfikator ${q.id}, obejmującą wskazany zakres, termin, cenę ${money(q.package.price)} i zaliczkę ${money(q.package.deposit)}, oraz otrzymany regulamin. Zawieram umowę z obowiązkiem zapłaty”. Możesz użyć własnych jednoznacznych słów.\n\nMasz prawo odstąpienia w ciągu 14 dni od zawarcia umowy. Jeżeli usługa ma rozpocząć się wcześniej, osobno i dobrowolnie dodaj do odpowiedzi: „${earlyStartStatement}”. Bez tego żądania uzgodnimy realizację po upływie terminu.\n`;
  else {if(!p.contractAt)throw new Error('CONTRACT_REQUIRED');text+=`\nPotwierdzamy otrzymanie Twojej e-mailowej akceptacji ${moment(p.contractAt)}. Umowa została zawarta na warunkach powyższej oferty. Odrębne żądanie wcześniejszego rozpoczęcia: ${p.earlyStart?'TAK':'NIE'}.\n`;}
  text+='\n'+documents(q.documents)+'\nZachowaj tę wiadomość i pełne warunki.\n';
 }
 if(kind==='completed'){if(!p.deliveryEvidence?.receivedAt||!p.offer?.bankAccount)throw new Error('DELIVERY_REQUIRED');text+=`\nZdjęcia przed i po oraz rozliczenie zostały przekazane w osobnej wiadomości. Potwierdzony odbiór: ${moment(p.deliveryEvidence.receivedAt)}. Otrzymane wpłaty netto po zwrotach: ${money(p.deliveryEvidence.paidAmount)}. Pozostała należność: ${money(Math.max(0,p.package.price-p.deliveryEvidence.paidAmount))}, przelewem do ${moment(new Date(Date.parse(p.deliveryEvidence.receivedAt)+86400000).toISOString())}. Rachunek SO SOCIAL: ${p.offer.bankAccount}. Tytuł: Czysty Pomnik CP-${p.number}.\nReklamacje: czystypomnikwarszawa@gmail.com lub ${company.address}.\n`;}
 if(kind==='deposit')text+=`\nOdnotowano wpłatę ${money(p.depositReceived)}. Pozostało ${money(p.package.price-p.depositReceived)}.\n`;
 if(kind==='changed')text+=`\nStatus: ${statusLabels[p.status]||p.status}. Otrzymana wpłata: ${money(p.depositReceived||0)}. Zwrócono: ${money(p.depositRefunded||0)}.\n${p.message||''}\n`;
 if(kind!=='owner')text+=`\nKontakt: ${company.email||'czystypomnikwarszawa@gmail.com'}, 693 429 991.\n`;
 return {subject,text};
}
export async function processOutbox() {
  if (!db || !process.env.RESEND_API_KEY) throw new Error('NOT_READY');
  const jobs = await rpc('claim_outbox'); let sent = 0;
  for (const job of jobs) {
    try {
      const mail = messageFor(job.kind, job.payload);
      const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': job.id }, body: JSON.stringify({ from: process.env.MAIL_FROM, reply_to:process.env.MAIL_REPLY_TO||'czystypomnikwarszawa@gmail.com', to: [job.recipient], ...mail }), signal: AbortSignal.timeout(20000) });
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
