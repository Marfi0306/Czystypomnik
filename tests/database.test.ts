import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
const db=new PGlite();const c1=randomUUID(),c2=randomUUID();let sequence=0;
const input=(cem=c1,date='2099-10-26')=>({idempotencyKey:randomUUID(),packageId:'silver',quotedPrice:19900,quotedDeposit:5000,cemeteryId:cem,date,variant:'single-granite',name:'Test',phone:'+48600000000',email:'test@example.invalid',location:'Od głównej bramy trzecia alejka w prawo.',inscription:'Osoba Testowa',sector:'',row:'',grave:'',notes:'',terms:true,earlyStart:false,documentsVersion:'test'});
async function call(name:string,args:unknown[]){const q=await db.query<{value:any}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args);return q.rows[0]?.value;}
async function reserve(p:ReturnType<typeof input>){return call('reserve_order',[JSON.stringify(p),JSON.stringify(p),'secret','web','test']);}
async function accept(id:string){
 await call('admin_change',[id,'offer',JSON.stringify({scope:'Uzgodniony pełny zakres testowej usługi',bankAccount:'11111111111111111111111111',validUntil:'2099-10-20T10:00:00Z',depositDue:'2099-10-21T10:00:00Z',price:19900,deposit:5000}),'test']);
 const q=await db.query<{offer_id:string}>('select offer_id from orders where id=$1',[id]);
 await db.query("update outbox set state='sent',provider_id='test-provider' where order_id=$1 and kind='offer'",[id]);
 await call('admin_change',[id,'contract',JSON.stringify({offerId:q.rows[0].offer_id,acceptedAt:new Date().toISOString(),acceptanceEmail:'Akceptuję konkretną ofertę z obowiązkiem zapłaty.',emailMessageId:'<test@example.invalid>',verifiedSender:true,earlyStartEvidence:''}),'test']);
}
async function day(date:string,team:number|null,local:number|null=team){await call('configure_day',[date,null,team,false,'test']);for(const c of [c1,c2])await call('configure_day',[date,c,local,false,'test']);}
before(async()=>{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
 await db.exec(await readFile(new URL('../supabase/migrations/001_orders.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/003_attachment_limit.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/004_offers_and_retention.sql',import.meta.url),'utf8'));
 await db.query('insert into cemeteries(id,name,address) values($1,$2,$3),($4,$5,$6)',[c1,'Test A','Adres A',c2,'Test B','Adres B']);
 await db.exec(`update settings set ready=true,documents_version='test',business='{"email":"owner@example.invalid"}',documents='{"regulamin":"Test"}';`);
});
after(async()=>{await db.close();});
test('10 miejsc i 5 rezerwacji daje 5; ponowienie nie tworzy zajęcia ani e-maili',async()=>{await day('2099-10-26',10);const first=input();const o=await reserve(first);for(let i=0;i<4;i++)await reserve(input());assert.equal(await call('capacity_left',[c1,'2099-10-26',1]),5);assert.equal((await reserve(first)).id,o.id);const rows=await db.query<{n:number}>('select count(*)::int n from outbox where order_id=$1',[o.id]);assert.equal(rows.rows[0].n,2);await assert.rejects(()=>reserve({...first,name:'Inna osoba'}),/IDEMPOTENCY_CONFLICT/);});
test('wiele prób na ostatnie miejsce: jedna rezerwacja',async()=>{await day('2099-10-27',1);const result=await Promise.allSettled(Array.from({length:6},()=>reserve(input(c1,'2099-10-27'))));assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(result.filter(r=>r.status==='rejected').length,5);});
test('podwójne anulowanie zwalnia tylko raz',async()=>{await day('2099-10-28',2);const o=await reserve(input(c1,'2099-10-28'));await call('admin_change',[o.id,'status',JSON.stringify({status:'cancelled',message:'Test anulowania'}),'test']);await call('admin_change',[o.id,'status',JSON.stringify({status:'cancelled',message:'Test anulowania'}),'test']);assert.equal(await call('capacity_left',[c1,'2099-10-28',1]),2);});
test('ukończenie nie zwalnia pojemności; wpłata wymaga przyjęcia',async()=>{await day('2099-10-29',2);const o=await reserve(input(c1,'2099-10-29'));await assert.rejects(()=>call('admin_change',[o.id,'deposit','{}','test']),/NOT_ACCEPTED/);await accept(o.id);for(const status of ['scheduled','in_progress','completed'])await call('admin_change',[o.id,'status',JSON.stringify({status,...(status==='completed'?{paidAmount:0,paymentVerified:true,deliveryEmailId:'message-delivery',deliveryEvidence:'Zdjęcia przed i po oraz rozliczenie przekazane i odebrane.',receivedAt:new Date().toISOString()}: {})}),'test']);await call('admin_change',[o.id,'deposit','{}','test']);await call('admin_change',[o.id,'deposit','{}','test']);assert.equal(await call('capacity_left',[c1,'2099-10-29',1]),1);await assert.rejects(()=>call('admin_change',[o.id,'status',JSON.stringify({status:'cancelled',message:'Test'}),'test']),/TERMINAL_STATUS/);});
test('łączny limit blokuje drugą lokalizację',async()=>{await day('2099-10-30',1,10);await reserve(input(c1,'2099-10-30'));await assert.rejects(()=>reserve(input(c2,'2099-10-30')),/FULL/);});
test('nieudane przeniesienie zachowuje starą rezerwację',async()=>{await day('2099-10-31',1);const o=await reserve(input(c1,'2099-10-31'));await assert.rejects(()=>call('admin_change',[o.id,'move',JSON.stringify({date:'2099-10-30',cemeteryId:c2,message:'Zmiana'}),'test']),/FULL/);const r=await db.query<{date:string;status:string}>('select date::text,status from orders where id=$1',[o.id]);assert.equal(r.rows[0].date,'2099-10-31');assert.equal(r.rows[0].status,'pending');});
test('bez limitu nie oznacza fikcyjnej liczby miejsc; zamknięcie blokuje nowe',async()=>{await day('2099-11-01',null);await reserve(input(c1,'2099-11-01'));assert.equal(await call('capacity_left',[c1,'2099-11-01',1]),null);await call('configure_day',['2099-11-01',c1,null,true,'test']);await assert.rejects(()=>reserve(input(c1,'2099-11-01')),/FULL/);});
test('limit nie może spaść poniżej istniejącego obłożenia',async()=>{await assert.rejects(()=>call('configure_day',['2099-10-26',null,4,false,'test']),/CAPACITY_BELOW_OCCUPANCY/);});
test('snapshot zachowuje cenę; serwer ignoruje cenę w żądaniu',async()=>{await day('2099-11-02',null);const p={...input(c1,'2099-11-02'),price:1};const o=await reserve(p);await call('configure_package',['silver',22900,5000,1,true,'test']);const r=await db.query<{p:any}>('select package_snapshot as p from orders where id=$1',[o.id]);assert.equal(r.rows[0].p.price,19900);await assert.rejects(()=>reserve(input(c1,'2099-11-02')),/PACKAGE_CHANGED/);await call('configure_package',['silver',19900,5000,1,true,'test']);});
test('ręczne zamówienie zużywa tę samą pulę',async()=>{await day('2099-11-03',1);const p=input(c1,'2099-11-03');await call('reserve_order',[JSON.stringify(p),'hash','secret','phone','admin']);await assert.rejects(()=>reserve(input(c1,'2099-11-03')),/FULL/);});
test('błąd e-maila nie cofa zamówienia; outbox może być pobrany ponownie',async()=>{await day('2099-11-04',1);const o=await reserve(input(c1,'2099-11-04'));await db.query("update outbox set state='failed',attempts=1,last_error='MAIL_HTTP_500' where order_id=$1",[o.id]);assert.equal(await call('capacity_left',[c1,'2099-11-04',1]),0);const r=await db.query<{n:number}>('select count(*)::int n from orders where id=$1',[o.id]);assert.equal(r.rows[0].n,1);await db.exec("update outbox set next_attempt_at=now()-interval '1 hour' where state='failed'");const jobs=await db.query('select * from claim_outbox()');assert.ok(jobs.rows.length>0);});
test('anon nie odczytuje klientów, historii, zdjęć ani funkcji zapisu',async()=>{await db.exec('set role anon');try{for(const table of ['orders','attachments','outbox','history','settings'])await assert.rejects(()=>db.query(`select * from ${table}`),/permission denied/);await assert.rejects(()=>call('reserve_order',['{}','h','s','web','anon']),/permission denied/);}finally{await db.exec('reset role');}});
test('zmiana wersji warunków i niegotowy system odrzucają zapis',async()=>{await day('2099-11-05',1);await assert.rejects(()=>reserve({...input(c1,'2099-11-05'),documentsVersion:'old'}),/DOCUMENTS_CHANGED/);await db.exec('update settings set ready=false');await assert.rejects(()=>reserve(input(c1,'2099-11-05')),/NOT_READY/);await db.exec('update settings set ready=true');});
test('limit 3 prywatnych załączników jest transakcyjny',async()=>{await day('2099-11-06',null);const o=await reserve(input(c1,'2099-11-06'));for(let i=0;i<3;i++)await call('attach_photo',[o.id,`${o.id}/${++sequence}.webp`,1000]);await assert.rejects(()=>call('attach_photo',[o.id,`${o.id}/extra.webp`,1000]),/INVALID_FILE/);});
test('ograniczenie prób działa w bazie',async()=>{for(let i=0;i<10;i++)assert.equal(await call('take_rate',['test-rate']),true);assert.equal(await call('take_rate',['test-rate']),false);});

test('nie można zawrzeć umowy zwykłą zmianą statusu ani bez wysłanej oferty',async()=>{
 await day('2099-11-07',null);const o=await reserve(input(c1,'2099-11-07'));
 await assert.rejects(()=>call('admin_change',[o.id,'status',JSON.stringify({status:'accepted'}),'test']),/CONTRACT_EVIDENCE_REQUIRED/);
 await call('admin_change',[o.id,'offer',JSON.stringify({scope:'Pełny uzgodniony zakres usługi testowej',bankAccount:'11111111111111111111111111',validUntil:'2099-10-20T10:00:00Z',depositDue:'2099-10-21T10:00:00Z',price:19900,deposit:5000}),'test']);
 const q=await db.query<{offer_id:string}>('select offer_id from orders where id=$1',[o.id]);
 const data={offerId:q.rows[0].offer_id,acceptedAt:new Date().toISOString(),acceptanceEmail:'Akceptuję ofertę z obowiązkiem zapłaty.',emailMessageId:'<test2@example.invalid>',verifiedSender:true,earlyStartEvidence:''};
 await assert.rejects(()=>call('admin_change',[o.id,'contract',JSON.stringify(data),'test']),/OFFER_NOT_SENT/);
 await db.query("update outbox set state='sent',provider_id='test-provider' where order_id=$1 and kind='offer'",[o.id]);
 await assert.rejects(()=>call('admin_change',[o.id,'contract',JSON.stringify({...data,verifiedSender:false}),'test']),/CONTRACT_EVIDENCE_REQUIRED/);
 await call('admin_change',[o.id,'contract',JSON.stringify(data),'test']);await call('admin_change',[o.id,'contract',JSON.stringify(data),'test']);
 const n=await db.query<{n:number}>("select count(*)::int n from outbox where order_id=$1 and kind='contract'",[o.id]);assert.equal(n.rows[0].n,1);
});
test('retencja respektuje ochronę i usuwa niepotwierdzone zgłoszenie dopiero po Storage',async()=>{
 await day('2099-11-08',null);const expired=await reserve(input(c1,'2099-11-08'));const held=await reserve(input(c1,'2099-11-08'));
 await call('attach_photo',[expired.id,expired.id+'/old.webp',1000]);
 await db.query("update orders set last_contact_at=now()-interval '91 days' where id in ($1,$2)",[expired.id,held.id]);await db.query("update orders set retention_hold=true,retention_reason='Sprawa testowa' where id=$1",[held.id]);
 const jobs=await call('retention_candidates',[]);assert.equal(jobs.length,1);assert.equal(jobs[0].id,expired.id);assert.equal(jobs[0].paths.length,1);
 await assert.rejects(()=>call('admin_change',[expired.id,'note',JSON.stringify({note:'Edycja'}),'test']),/RETENTION_IN_PROGRESS/);
 await call('finish_retention',[expired.id,true]);const n=await db.query<{n:number}>('select count(*)::int n from orders where id in ($1,$2)',[expired.id,held.id]);assert.equal(n.rows[0].n,1);
});
test('bliski termin wymaga osobnego oświadczenia dopiero przy umowie',async()=>{
 const r=await db.query<{date:string}>("select ((now() at time zone 'Europe/Warsaw')::date+14)::text as date");const date=r.rows[0].date;await day(date,null);const o=await reserve(input(c1,date));
 await call('admin_change',[o.id,'offer',JSON.stringify({scope:'Pełny zakres usługi zaakceptowany podczas konsultacji.',bankAccount:'11111111111111111111111111',validUntil:new Date(Date.now()+3600000).toISOString(),depositDue:new Date(Date.now()+7200000).toISOString(),price:19900,deposit:5000}),'test']);
 const q=await db.query<{offer_id:string}>('select offer_id from orders where id=$1',[o.id]);await db.query("update outbox set state='sent',provider_id='test-provider' where order_id=$1 and kind='offer'",[o.id]);
 const data={offerId:q.rows[0].offer_id,acceptedAt:new Date().toISOString(),acceptanceEmail:'Akceptuję wskazaną ofertę z obowiązkiem zapłaty.',emailMessageId:'<early@example.invalid>',verifiedSender:true,earlyStartEvidence:''};
 await assert.rejects(()=>call('admin_change',[o.id,'contract',JSON.stringify(data),'test']),/EARLY_START_REQUIRED/);
 await call('admin_change',[o.id,'contract',JSON.stringify({...data,earlyStartEvidence:'Wyraźnie żądam wcześniejszego rozpoczęcia i przyjmuję skutki dla prawa odstąpienia.'}),'test']);
 const contract=await db.query<{early_start:boolean;contract_at:string}>('select early_start,contract_at from orders where id=$1',[o.id]);assert.ok(contract.rows[0].contract_at);assert.equal(contract.rows[0].early_start,true);
});
test('wygaśnięta oferta nie może być zaakceptowana po terminie',async()=>{
 await day('2099-11-09',null);const o=await reserve(input(c1,'2099-11-09'));await call('admin_change',[o.id,'offer',JSON.stringify({scope:'Pełny uzgodniony zakres usługi testowej',bankAccount:'11111111111111111111111111',validUntil:'2099-10-20T10:00:00Z',depositDue:'2099-10-21T10:00:00Z',price:19900,deposit:5000}),'test']);
 const q=await db.query<{offer_id:string}>('select offer_id from orders where id=$1',[o.id]);await db.query("update offers set created_at=now()-interval '2 hours',valid_until=now()-interval '1 hour' where id=$1",[q.rows[0].offer_id]);await db.query("update outbox set state='sent',provider_id='test-provider' where order_id=$1 and kind='offer'",[o.id]);
 await assert.rejects(()=>call('admin_change',[o.id,'contract',JSON.stringify({offerId:q.rows[0].offer_id,acceptedAt:new Date().toISOString(),acceptanceEmail:'Akceptuję ofertę z obowiązkiem zapłaty.',emailMessageId:'<expired@example.invalid>',verifiedSender:true,earlyStartEvidence:''}),'test']),/OFFER_EXPIRED/);
});
