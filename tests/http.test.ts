import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import app from '../server/index';
import type {Server} from 'node:http';
let server:Server;let base:string;
before(async()=>{await new Promise<void>(resolve=>{server=app.listen(0,'127.0.0.1',()=>resolve());});const address=server.address();if(!address||typeof address==='string')throw new Error('NO_ADDRESS');base=`http://127.0.0.1:${address.port}`;});
after(async()=>{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));});
test('bez konfiguracji API zwraca podgląd, nie odbiera zgłoszeń',async()=>{
 let r=await fetch(base+'/api/config');assert.equal(r.status,200);assert.deepEqual(await r.json(),{mode:'demo'});
 process.env.APP_ORIGIN=base;
 r=await fetch(base+'/api/orders',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:'{}'});assert.equal(r.status,503);assert.equal((await r.json()).error,'NOT_READY');
});
test('API blokuje obce pochodzenie i nieuprawniony harmonogram',async()=>{
 const r=await fetch(base+'/api/orders',{method:'POST',headers:{origin:'https://example.invalid','content-type':'application/json'},body:'{}'});assert.equal(r.status,403);
 for(const route of ['outbox','retention']){const job=await fetch(base+'/api/internal/'+route,{method:'POST'});assert.equal(job.status,401);}
});
