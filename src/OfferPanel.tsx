import {useState} from 'react';
import {money} from '../shared/domain';
type Offer={id:string;created_at:string;valid_until:string;payload:any};
export default function OfferPanel({order,offers,busy,action}:{order:any;offers:Offer[];busy:boolean;action:(action:string,data:unknown)=>Promise<void>}){
 const [scope,setScope]=useState('');const [bank,setBank]=useState('');const [valid,setValid]=useState('');const [due,setDue]=useState('');const [price,setPrice]=useState(String(order.package_snapshot.price/100));const [deposit,setDeposit]=useState(String(order.package_snapshot.deposit/100));
 const [accepted,setAccepted]=useState('');const [email,setEmail]=useState('');const [emailId,setEmailId]=useState('');const [verified,setVerified]=useState(false);const [early,setEarly]=useState('');const [error,setError]=useState('');
 const latest=offers.find(q=>q.id===order.offer_id);
 function submit(fn:()=>Promise<void>){setError('');void fn().catch(e=>setError(e instanceof Error?e.message:'Nie udało się zapisać.'));}
 const iso=(v:string)=>new Date(v).toISOString();
 if(order.contract_at)return <section className="panel"><h3>Umowa zawarta</h3><p>{new Date(order.contract_at).toLocaleString('pl-PL')} · oferta {order.offer_id}</p><p>Odrębne żądanie wcześniejszego rozpoczęcia: {order.early_start?'utrwalone':'brak'}</p><details><summary>Dowód akceptacji e-mailowej</summary><pre>{JSON.stringify(order.contract_evidence,null,2)}</pre></details></section>;
 if(order.status!=='pending')return null;
 if(!order.date)return <section className="panel"><h3>Oferta po konsultacji</h3><p>Najpierw wybierz i zapisz dzień w kalendarzu powyżej. Dopiero wtedy przygotuj ofertę dla klienta.</p></section>;
 return <section className="panel"><h3>Oferta po konsultacji</h3><p>Formularz klienta nie zawarł umowy. Przygotuj pełną ofertę z danymi potwierdzonymi podczas rozmowy. Terminy wprowadzasz w czasie urządzenia; wiadomość pokaże czas warszawski.</p>
 <form onSubmit={e=>{e.preventDefault();submit(()=>action('offer',{scope,bankAccount:bank,validUntil:iso(valid),depositDue:iso(due),price:Math.round(Number(price)*100),deposit:Math.round(Number(deposit)*100)}));}}>
 <label>Dokładny uzgodniony zakres<textarea required minLength={20} maxLength={4000} value={scope} onChange={e=>setScope(e.target.value)}/></label>
 <div className="field-row two"><label>Łączna cena brutto (zł)<input type="number" min="0.01" step="0.01" required value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Zaliczka (zł)<input type="number" min="0.01" step="0.01" required value={deposit} onChange={e=>setDeposit(e.target.value)}/></label></div>
 <label>Zweryfikowany rachunek SO SOCIAL<input required value={bank} onChange={e=>setBank(e.target.value)} autoComplete="off" placeholder="26 cyfr rachunku spółki"/></label><label>Oferta ważna do<input required type="datetime-local" value={valid} onChange={e=>setValid(e.target.value)}/></label><label>Termin zaliczki<input required type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label>
 <button className="button secondary" disabled={busy}>Zapisz ofertę i zleć wysyłkę pełnych warunków</button></form>
 {latest&&<><h3>Akceptacja konkretnej oferty</h3><p>Oferta {latest.id} · {money(latest.payload.package.price)} · ważna do {new Date(latest.valid_until).toLocaleString('pl-PL')}. Zapisz rzeczywistą odpowiedź klienta ze skrzynki; system nie odczytuje Gmail. Najpierw oferta musi zostać wysłana.</p>
 <form onSubmit={e=>{e.preventDefault();submit(()=>action('contract',{offerId:latest.id,acceptedAt:iso(accepted),acceptanceEmail:email,emailMessageId:emailId,verifiedSender:verified,earlyStartEvidence:early}));}}>
 <label>Moment otrzymania akceptacji<input type="datetime-local" required value={accepted} onChange={e=>setAccepted(e.target.value)}/></label><label>Identyfikator wiadomości e-mail<input required value={emailId} onChange={e=>setEmailId(e.target.value)}/></label><label>Pełna treść otrzymanej akceptacji<textarea required minLength={30} maxLength={16000} value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Osobne żądanie wcześniejszego rozpoczęcia — jeśli otrzymano<textarea maxLength={4000} value={early} onChange={e=>setEarly(e.target.value)}/></label>
 <label className="checkbox"><input required type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/><span>Sprawdziłem nadawcę ({order.customer.email}), treść akceptacji tej konkretnej oferty z obowiązkiem zapłaty i rzeczywisty czas odbioru. Wcześniejsze rozpoczęcie jest oparte na osobnym oświadczeniu klienta.</span></label><button className="button primary" disabled={busy}>Utrwal akceptację i potwierdź zawarcie umowy</button></form></>}
 {offers.length>0&&<details><summary>Wersje ofert</summary>{offers.map(q=><div key={q.id}><p>{q.id} · {new Date(q.created_at).toLocaleString('pl-PL')}</p><pre>{JSON.stringify(q.payload,null,2)}</pre></div>)}</details>}
 {error&&<p className="error" role="alert">{error}</p>}</section>;
}
