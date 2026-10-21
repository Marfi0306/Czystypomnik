import { useEffect,useRef,useState } from 'react';
import { dateLabel,money,normalizePhone,orderSchema,type Config,type Day,type OrderInput } from '../shared/domain';
import { demoDays } from './demo';
import { api,errorText } from './api';
import { termsStatement } from '../shared/consent';
import {track} from './analytics';
import {marketingRequestHeaders,reportMarketingDelivery} from './marketing';
import DayCalendar from './DayCalendar';
export default function OrderForm({config,selected,onSelect,manual=false,onDone}:{config:Config;selected:string;onSelect:(v:string)=>void;manual?:boolean;onDone?:()=>void}) {
 const [uncertain,setUncertain]=useState(false); const [submitted,setSubmitted]=useState<OrderInput|null>(null); const [step,setStep]=useState(0); const [days,setDays]=useState<Day[]>([]); const [loading,setLoading]=useState(false); const [error,setError]=useState(''); const [errors,setErrors]=useState<Record<string,string>>({}); const [busy,setBusy]=useState(false); const [demoDone,setDemoDone]=useState(false); const [receipt,setReceipt]=useState<{number:number;id:string;uploadToken:string}|null>(null); const [photoError,setPhotoError]=useState(''); const [files,setFiles]=useState<File[]>([]); const [source,setSource]=useState('phone');
 const [form,setForm]=useState<Omit<OrderInput,'packageId'|'idempotencyKey'|'documentsVersion'|'quotedPrice'|'quotedDeposit'>>({cemeteryId:'',date:'',variant:'single-granite',location:'',inscription:'',sector:'',row:'',grave:'',name:'',phone:'+48 ',email:'',notes:'',terms:false as unknown as true,earlyStart:false,website:''});
 const [previewUrls,setPreviewUrls]=useState<string[]>([]); const attempt=useRef<{key:string;payload?:OrderInput}>({key:crypto.randomUUID()}); const heading=useRef<HTMLHeadingElement>(null);
 const pkg=config.packages.find(p=>p.id===selected); const demo=config.mode==='demo';
 function change(key:string,value:unknown){track(!demo&&!manual,'form_started',{submissionId:attempt.current.key});if(key==='date'&&value)track(!demo,'date_selected');setForm(f=>({...f,[key]:value}));setErrors(e=>({...e,[key]:''}));setError('');}
 useEffect(()=>{const urls=files.map(f=>URL.createObjectURL(f));setPreviewUrls(urls);return()=>urls.forEach(URL.revokeObjectURL);},[files]);
 useEffect(()=>{
  if(!manual||!form.cemeteryId||!selected) {setDays([]);return;}
  let active=true;const controller=new AbortController();
  async function refresh(){
   if(document.hidden) return;
   if(demo){setDays(demoDays);setLoading(false);return;}
   try{const r=await fetch(`/api/availability?cemetery=${encodeURIComponent(form.cemeteryId)}&package=${encodeURIComponent(selected)}`,{signal:controller.signal});if(!r.ok)throw new Error();const data=await r.json() as Day[];if(active){setDays(data);setError('');}}
   catch(e){if(active && !controller.signal.aborted){setDays([]);setError('Nie możemy teraz sprawdzić dostępności. Spróbuj ponownie.');}}
   finally{if(active)setLoading(false);}
  }
  setLoading(true);void refresh(); const interval=setInterval(refresh,20000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{active=false;controller.abort();clearInterval(interval);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[form.cemeteryId,selected,demo,manual]);
 useEffect(()=>{if(manual&&!demo&&days.length&&!days.some(d=>d.date===form.date&&!d.closed&&d.remaining!==0)){if(form.date)setError('Ten dzień nie jest już dostępny. Wybierz inny — pozostałe dane są zachowane.');setForm(f=>({...f,date:''}));}},[days,demo,form.date,manual]);
 useEffect(()=>{if(step>0)heading.current?.focus();},[step]);
 const picked=days.find(d=>d.date===form.date);
 function payload():OrderInput{return {...form,phone:normalizePhone(form.phone),date:manual?form.date:undefined,quotedPrice:pkg?.price||0,quotedDeposit:pkg?.deposit||0,packageId:selected,idempotencyKey:attempt.current.key,documentsVersion:config.documentsVersion};}
 function validate(current:number){const result=orderSchema.safeParse(payload());const relevant=current===0?['packageId','cemeteryId',...(manual?['date']:[]),'variant']:current===1?['location','inscription','sector','row','grave']:['name','phone','email','terms','earlyStart','notes'];const found:Record<string,string>={};if(!result.success)for(const issue of result.error.issues){const key=String(issue.path[0]);if(relevant.includes(key))found[key]=issue.message;}if(manual&&current===0&&!picked)found.date='Wybierz dostępny dzień';setErrors(found);if(Object.keys(found).length){track(!demo&&!manual,'form_failed');setTimeout(()=>document.getElementById(Object.keys(found)[0])?.focus(),0);return false;}return true;}
 async function uploadPhotos(id:string,token:string){if(!files.length)return;for(const file of files){const body=new FormData();body.append('photos',file);const response=await fetch(`/api/orders/${id}/photos`,{method:'POST',headers:{'x-upload-token':token},body});if(!response.ok)throw new Error('UPLOAD_FAILED');}}
 async function submit(){
  if(!attempt.current.payload&&!validate(2))return;
  if(demo){setDemoDone(true);return;}
  const parsed=orderSchema.safeParse(attempt.current.payload||payload());if(!parsed.success){setError('Sprawdź wszystkie kroki formularza.');return;}
  setBusy(true);setError('');
  try{
   // Powtórzenie po niepewnej odpowiedzi wysyła ten sam klucz i dokładnie te same dane.
   const input=attempt.current.payload || payload();attempt.current.payload=input;
   track(!manual,'form_submitted',{submissionId:attempt.current.key});
   const result=await api(manual?'/admin/orders':'/orders',manual?{order:input,source}:input,undefined,manual?{}:marketingRequestHeaders());
   setSubmitted(input);setUncertain(false);setReceipt(result);track(!demo&&!manual,'order_saved',{orderNumber:result.number,submissionId:attempt.current.key});
   if(!manual)reportMarketingDelivery('Lead',result.marketingDelivery||'failed','cp-lead-'+attempt.current.key);
   if(!manual)try{await uploadPhotos(result.id,result.uploadToken);}catch{setPhotoError('Zgłoszenie zapisano. Zdjęcia nie zostały dodane — możesz ponowić ich wysłanie.');}
   onDone?.();
  }catch(e){track(!manual,'form_failed');setError(errorText(e));if(e instanceof Error && ['FULL','DOCUMENTS_CHANGED','VALIDATION_ERROR','PACKAGE_CHANGED','NOT_READY','RATE_LIMIT'].includes(e.message)){attempt.current={key:crypto.randomUUID()};setUncertain(false);}else setUncertain(true);}
  finally{setBusy(false);}
 }
 const err=(key:string)=>errors[key]?<span className="field-error" id={`${key}-error`}>{errors[key]}</span>:null;
 const input=(key:keyof typeof form,label:string,options:{optional?:boolean;type?:string;placeholder?:string;autocomplete?:string;max?:number;hint?:string}={})=><label className="field" htmlFor={key}>{label}{options.optional&&<span className="optional"> opcjonalnie</span>}<input id={key} name={key} type={options.type||'text'} autoComplete={options.autocomplete||'off'} maxLength={options.max||150} placeholder={options.placeholder} value={String(form[key])} onChange={e=>change(key,e.target.value)} onBlur={key==='phone'?e=>change('phone',normalizePhone(e.target.value)||'+48 '):undefined} aria-invalid={!!errors[key]} aria-describedby={[options.hint?`${key}-help`:'',errors[key]?`${key}-error`:''].filter(Boolean).join(' ')||undefined}/>{options.hint&&<small id={`${key}-help`}>{options.hint}</small>}{err(key)}</label>;
 if(receipt)return <div className="order-form receipt" role="status"><div className="success-icon">✓</div><p className="eyebrow">ZGŁOSZENIE ODEBRANE</p><h3>Numer CP-{receipt.number}</h3><p>{submitted?.date?'Wybrany dzień: '+dateLabel(submitted.date)+'.':'Termin realizacji ustalimy z Tobą telefonicznie.'} Zadzwonimy, aby ustalić szczegóły i przesłać ofertę e-mailem. Samo zgłoszenie nie stanowi zawarcia umowy.</p><p>Nie wpłacaj jeszcze zaliczki. {config.mailMode==='manual'?'Zapisz numer zgłoszenia. Zespół skontaktuje się z Tobą telefonicznie i prześle ofertę e-mailem.':'Potwierdzenie odbioru oczekuje na wysyłkę e-mailem.'}</p>{photoError&&<><p className="error">{photoError}</p><button className="button secondary" onClick={async()=>{try{await uploadPhotos(receipt.id,receipt.uploadToken);setPhotoError('');}catch{setPhotoError('Nie udało się dodać zdjęć. Zgłoszenie nadal jest zapisane.');}}}>Ponów wysyłanie zdjęć</button></>}</div>;
 if(demoDone)return <div className="order-form receipt" role="status"><div className="success-icon">✓</div><p className="eyebrow">KONIEC PODGLĄDU</p><h3>Tak będzie wyglądało zgłoszenie.</h3><p>Formularz został sprawdzony. Nie utworzyliśmy rezerwacji ani nie wysłaliśmy Twoich danych.</p><div className="summary"><span>{pkg?.name}</span><strong>{pkg&&money(pkg.price)}</strong><span>Dzień przykładowy</span><strong>{form.date?dateLabel(form.date):'Ustalimy telefonicznie'}</strong></div><button className="button primary" onClick={()=>{setDemoDone(false);setStep(0);}}>Wróć do formularza</button></div>;
 return <form className="order-form" id={manual?'manual-order':'formularz'} noValidate onSubmit={e=>{e.preventDefault();if(step<2){if(validate(step)){if(step===0)track(!demo&&!manual,'form_started',{submissionId:attempt.current.key});track(!demo&&!manual,'form_step',{step:step+2,submissionId:attempt.current.key});setStep(step+1);}}else void submit();}}>
  <div className="form-top"><span className="eyebrow">{manual?'ZAMÓWIENIE Z KONTAKTU':'TWÓJ WYBÓR. NASZA TROSKA.'}</span><span className="form-step">{step+1} / 3</span></div><h3 ref={heading} tabIndex={-1}>Zgłoś chęć pielęgnacji nagrobka</h3>
  <ol className="steps" aria-label="Postęp formularza">{[manual?'Usługa i dzień':'Usługa','Dane nagrobka','Kontakt'].map((s,i)=><li key={s} className={i===step?'current':i<step?'done':''} aria-current={i===step?'step':undefined}><span>{i<step?'✓':i+1}</span>{s}</li>)}</ol>
  {demo&&<p className="demo-note"><strong>Podgląd formularza.</strong> Przykładowe dni i cmentarz. Dane i zdjęcia nie są wysyłane. Do testowania użyj fikcyjnych danych.</p>}
  <fieldset disabled={busy||uncertain}><legend className="sr-only">{[manual?'Usługa i dzień':'Usługa','Dane nagrobka','Kontakt i podsumowanie'][step]}</legend>
  {step===0&&<>
   {manual&&<label className="field">Źródło<select value={source} onChange={e=>setSource(e.target.value)}><option value="phone">Telefon</option><option value="meta">Meta</option></select></label>}
   <label className="field" htmlFor="packageId">Pakiet<select id="packageId" value={selected} onChange={e=>onSelect(e.target.value)} aria-invalid={!!errors.packageId}><option value="">Wybierz pakiet</option>{config.packages.map(p=><option key={p.id} value={p.id}>{p.name} — {money(p.price)}</option>)}</select>{err('packageId')}</label>
   <div className="variant"><span>Zakres ceny</span><strong>Pojedynczy nagrobek granitowy</strong><p>Standardowy rozmiar i zwykłe zabrudzenie. Inny nagrobek? <a href="tel:+48693429991">Ustal wycenę telefonicznie</a>.</p></div>
   <label className="field" htmlFor="cemeteryId">Cmentarz<input type="search" placeholder="Wpisz nazwę i wybierz z listy" list="cemeteries" id="cemetery-search" onBlur={e=>{if(e.target.value.trim())track(!demo&&!manual,'cemetery_searched');}} onChange={e=>{const c=config.cemeteries.find(c=>`${c.name} — ${c.address}`===e.target.value);change('cemeteryId',c?.id||'');change('date','');}} aria-label="Wyszukaj cmentarz"/><datalist id="cemeteries">{config.cemeteries.map(c=><option key={c.id} value={`${c.name} — ${c.address}`}/>)}</datalist><select id="cemeteryId" value={form.cemeteryId} onChange={e=>{change('cemeteryId',e.target.value);change('date','');}} aria-invalid={!!errors.cemeteryId}><option value="">Wybierz cmentarz</option>{config.cemeteries.map(c=><option key={c.id} value={c.id}>{c.name} — {c.address}</option>)}</select>{err('cemeteryId')}</label>
   {manual?<div id="date" tabIndex={-1}>{!form.cemeteryId?<p>Wybierz cmentarz, aby zobaczyć dostępne dni.</p>:<DayCalendar days={days} date={form.date||''} onSelect={date=>change('date',date)} loading={loading}/ >}{err('date')}</div>:<p className="payment-note">Termin realizacji ustalimy z Tobą telefonicznie po otrzymaniu zgłoszenia.</p>}
  </>}
  {step===1&&<>
   <p className="payment-note"><strong>Nie znasz numerów? To nie problem.</strong> Te trzy pola możesz zostawić puste. Opisz poniżej, jak znaleźć nagrobek, i podaj nazwisko z tablicy.</p><div className="field-row grave-fields">{input('sector','Kwatera / sektor',{optional:true,max:80,placeholder:'Np. A lub 12',hint:'Wydzielona część cmentarza, oznaczona literą lub numerem.'})}{input('row','Rząd',{optional:true,max:80,placeholder:'Np. 3',hint:'Rząd grobów w tej części cmentarza.'})}{input('grave','Numer grobu',{optional:true,max:80,placeholder:'Np. 25',hint:'Numer konkretnego miejsca w rzędzie.'})}</div>
   <label className="field" htmlFor="location">Jak znaleźć nagrobek?<textarea id="location" maxLength={1000} rows={3} placeholder="Np. od głównej bramy prosto, trzecia alejka w prawo, przy dużym dębie…" value={form.location} onChange={e=>change('location',e.target.value)} aria-invalid={!!errors.location} aria-describedby="location-help"/><small id="location-help">Opisz drogę od bramy i charakterystyczne miejsca, np. alejkę lub duże drzewo. Nie musisz znać numerów. Przy opcji „Inny cmentarz” podaj też jego nazwę i adres. Co najmniej 20 znaków.</small>{err('location')}</label>
   {input('inscription','Imię i nazwisko osoby z tablicy',{placeholder:'Dane co najmniej jednej pochowanej osoby',max:300})}
   {!manual&&<div className="field"><label htmlFor="photos">Zdjęcia nagrobka <span className="optional">opcjonalnie</span></label><label className="upload-area" htmlFor="photos"><span className="upload-icon">↥</span><strong>Dodaj zdjęcia ułatwiające odnalezienie</strong><span>Do 3 plików JPG, PNG lub WebP, do 3 MB każdy.</span></label><input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{const added=Array.from(e.target.files||[]);if(added.length>3||added.some(f=>f.size>3145728||!['image/jpeg','image/png','image/webp'].includes(f.type))){setPhotoError('Wybierz do 3 zdjęć JPG, PNG lub WebP, do 3 MB każde. Zdjęcie HEIC z iPhone’a wyeksportuj jako JPEG.');e.target.value='';return;}setFiles(added);setPhotoError('');}}/><small>HEIC z iPhone’a: wyeksportuj zdjęcie jako JPEG. Zdjęcia nie będą publikowane.</small>{photoError&&<p className="field-error">{photoError}</p>}<div className="photo-previews">{files.map((f,i)=><div key={f.name+i}><img src={previewUrls[i]} alt={`Podgląd zdjęcia ${i+1}`}/><button type="button" aria-label={`Usuń zdjęcie ${i+1}`} onClick={()=>setFiles(files.filter((_,n)=>n!==i))}>×</button><small>{f.name}</small></div>)}</div></div>}
  </>}
  {step===2&&<>
   {input('name','Twoje imię i nazwisko',{autocomplete:'name'})}
   <div className="field-row two">{input('phone','Telefon',{type:'tel',autocomplete:'tel',max:30,placeholder:'+48 600 000 000',hint:'Dla polskiego numeru wpisz 9 cyfr — dodamy +48. Numer zagraniczny wpisz z jego kodem, np. +44. Prefiks możesz zmienić.'})}{input('email','E-mail',{type:'email',autocomplete:'email',max:254})}</div>
   <label className="field" htmlFor="notes">Uwagi <span className="optional">opcjonalnie</span><textarea id="notes" maxLength={2000} rows={2} value={form.notes} onChange={e=>change('notes',e.target.value)}/></label>
   <div className="summary"><span>Pakiet {pkg?.name}</span><strong>{pkg&&money(pkg.price)} brutto</strong><span>Cmentarz</span><strong>{config.cemeteries.find(c=>c.id===form.cemeteryId)?.name}</strong><span>Termin realizacji</span><strong>{form.date?dateLabel(form.date):'Ustalimy telefonicznie'}</strong><span>Zaliczka po akceptacji oferty</span><strong>{pkg&&money(pkg.deposit)}</strong><span>Pozostała należność</span><strong>{pkg&&money(pkg.price-pkg.deposit)}</strong></div>
   <p className="payment-note">Wysłanie formularza nie zawiera odpłatnej umowy ani nie zobowiązuje do zapłaty. Zadzwonimy w sprawie wybranego pakietu i terminu. Po rozmowie otrzymasz ofertę e-mailem do akceptacji. Zaliczka jest płatna dopiero po zawarciu umowy.</p>
   <label className="checkbox"><input id="terms" type="checkbox" checked={!!form.terms} onChange={e=>change('terms',e.target.checked)}/><span>{pkg&&termsStatement} <a href="/dokumenty/regulamin" target="_blank" rel="noreferrer">Regulamin obsługi zgłoszeń</a>.{demo&&' W podglądzie jest to wyłącznie test pola.'}</span></label>{err('terms')}

   <p className="privacy-note">{demo?'W podglądzie dane pozostają w pamięci tej karty.':'Administratorem Twoich danych jest '+config.business.name+'. Dane wykorzystamy do obsługi zgłoszenia, kontaktu telefonicznego oraz przesłania oferty e-mailem. Podstawą jest podjęcie działań na Twoje żądanie przed zawarciem umowy, a po jej zawarciu — wykonanie umowy.'} <a href="/dokumenty/prywatnosc" target="_blank" rel="noreferrer">Polityka prywatności</a>. Warunki anulowania i reklamacji: <a href="/dokumenty/regulamin" target="_blank" rel="noreferrer">regulamin</a>.</p>
   <div className="honeypot" aria-hidden="true"><label>Strona internetowa<input name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>change('website',e.target.value)}/></label></div>
  </>}
  </fieldset>
  {error&&<p className="error" role="alert">{error}{uncertain&&" Wynik poprzedniej próby jest niepewny. Ponowienie sprawdzi tę samą próbę i nie utworzy drugiej rezerwacji. Wysłane dane są zachowane."}</p>}
  <div className="form-actions">{step>0&&<button type="button" className="back" disabled={busy||uncertain} onClick={()=>setStep(step-1)}>← Wstecz</button>}<button type="submit" className="button primary" disabled={busy}>{busy?'Zapisujemy…':step<2?'Dalej':demo?'Sprawdź formularz w podglądzie':uncertain?'Sprawdź wynik poprzedniej próby':'Wyślij zgłoszenie do kontaktu'}{step<2&&<span>→</span>}</button></div>
  {step===0&&<p className="form-footnote">Bez konta · Bez płatności online · Oferta do akceptacji e-mailem</p>}
 </form>;
}
