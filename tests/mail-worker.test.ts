import {test} from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL='https://notification-db.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-key';
process.env.RESEND_API_KEY='re_test';process.env.MAIL_FROM='Czysty Pomnik <powiadomienia@mail.czystypomnik.waw.pl>';
process.env.MAIL_MODE='manual';process.env.APP_ORIGIN='https://czystypomnik.waw.pl';
const {processOutbox,ownerDelivery,messageFor}=await import('../server/mail');
const nativeFetch=globalThis.fetch;
const payload={number:1,date:'2026-10-24',package:{name:'Silver',price:19900},cemetery:{name:'Test',address:'Warszawa'},customer:{name:'Test',phone:'+48693429991',email:'test@example.invalid'},grave:{location:'Test',inscription:'Test'},documents:{business:{}}};
test('ręczny tryb wysyła wyłącznie alert właściciela i zachowuje idempotencję',async()=>{
 const calls:{url:string;body:any;headers:Headers}[]=[];
 globalThis.fetch=async(input,init)=>{const url=String(input);const body=init?.body?JSON.parse(String(init.body)):null;calls.push({url,body,headers:new Headers(init?.headers)});
 if(url.includes('/rpc/claim_team_outbox'))return Response.json([{id:'owner-test',kind:'owner',recipient:'czystypomnikwarszawa@gmail.com',attempts:1,payload}]);
 if(url==='https://api.resend.com/emails')return Response.json({id:'provider-test'});
 if(url.includes('/rest/v1/outbox'))return new Response(null,{status:204});
 throw new Error('UNEXPECTED_REQUEST '+url);};
 try{assert.deepEqual(await processOutbox(),{processed:1,sent:1});const sent=calls.find(c=>c.url==='https://api.resend.com/emails')!;assert.deepEqual(sent.body.to,['czystypomnikwarszawa@gmail.com']);assert.equal(sent.headers.get('Idempotency-Key'),'owner-test');assert.ok(sent.body.text.includes('https://czystypomnik.waw.pl/admin'));assert.ok(!calls.some(c=>c.url.endsWith('/rpc/claim_outbox')));}finally{globalThis.fetch=nativeFetch;}
});
test('brak uprawnień do odczytu Resend nie jest potwierdzeniem dostarczenia ani błędem wysyłki',async()=>{
 globalThis.fetch=async(input)=>String(input).includes('/rest/v1/outbox')?Response.json({kind:'owner',recipient:'czystypomnikwarszawa@gmail.com',state:'sent',provider_id:'test'}):Response.json({message:'restricted'},{status:403});
 try{assert.deepEqual(await ownerDelivery('test'),{state:'sent',event:null,verification:'provider_http_403'});}finally{globalThis.fetch=nativeFetch;}
});
test('e-mail przypisania prowadzi do chronionego panelu, a nieaktualne przypisanie nie jest wysyłane',async()=>{
 const mail=messageFor('worker_assignment',{number:12,workerName:'Szymon',date:'2026-10-24'});assert.ok(mail.text.includes('/ekipa'));assert.ok(mail.text.includes('Przyjęte'));assert.ok(!mail.text.includes('Cena'));let providerCalls=0;
 globalThis.fetch=async(input)=>{const url=String(input);if(url.includes('/rpc/claim_team_outbox'))return Response.json([{id:'stale-assignment',kind:'worker_assignment',recipient:'worker@example.invalid',payload:{}}]);if(url.includes('/rpc/worker_mail_valid'))return Response.json(false);if(url.includes('/rest/v1/outbox'))return new Response(null,{status:204});if(url==='https://api.resend.com/emails'){providerCalls++;return Response.json({id:'unexpected'});}throw new Error('UNEXPECTED_REQUEST');};
 try{assert.deepEqual(await processOutbox(),{processed:1,sent:0});assert.equal(providerCalls,0);}finally{globalThis.fetch=nativeFetch;}
});
