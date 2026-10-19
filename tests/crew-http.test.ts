import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {crewFixture} from './crew-fixture';
let f:Awaited<ReturnType<typeof crewFixture>>;
before(async()=>{f=await crewFixture();});after(async()=>f.close());
const post=async(path:string,data:any,cookie='')=>fetch(f.base+path,{method:'POST',headers:{origin:f.base,'content-type':'application/json',cookie},body:JSON.stringify(data)});
test('koordynator widzi wspólny kalendarz i zachowuje oddzielną sesję',async()=>{
 const r=await post('/api/admin/login',{email:'owner@example.invalid',password:'fixture-admin-password'});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie')!.split(';')[0];const today=(await import('../shared/domain')).localDate();
 const calendar=await fetch(f.base+`/api/admin/calendar?from=${today.slice(0,7)}-01&to=${today}`,{headers:{cookie}});assert.equal(calendar.status,200);const data=await calendar.json();assert.equal(data.orders.length,2);assert.equal(data.orders[0].date,today);assert.equal(data.workers.length,2);assert.equal(data.days[0].capacity,20);
 assert.equal((await fetch(f.base+'/api/worker/me',{headers:{cookie}})).status,401);
});
test('pracownik przez HTTP loguje się, widzi tylko swoje zadania i nie uzyskuje dostępu administratora',async()=>{
 assert.equal((await post('/api/worker/login',{login:'szymon',password:'wrong'})).status,401);
 const login=await post('/api/worker/login',{login:'szymon',password:f.testPassword});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie')!.split(';')[0];assert.match(login.headers.get('set-cookie')!,/HttpOnly/);assert.match(login.headers.get('set-cookie')!,/SameSite=Strict/);
 const r=await fetch(f.base+'/api/worker/orders',{headers:{cookie}});assert.equal(r.status,200);const orders=(await r.json()).orders;assert.equal(orders.length,1);assert.equal(orders[0].id,f.order1);assert.ok(!JSON.stringify(orders).includes('secret@example.invalid'));
 assert.equal((await fetch(f.base+'/api/worker/orders/'+f.order2,{headers:{cookie}})).status,404);
 assert.equal((await fetch(f.base+'/api/admin/orders',{headers:{cookie}})).status,401);
 const version=orders[0].assignment_version;assert.equal((await post('/api/worker/orders/'+f.order1,{action:'accept',version},cookie)).status,200);
 assert.equal((await post('/api/worker/orders/'+f.order1,{action:'complete',version},cookie)).status,409);
 const image=await sharp({create:{width:20,height:20,channels:3,background:'#fff'}}).png().toBuffer();const form=new FormData();form.append('photo',new Blob([new Uint8Array(image)],{type:'image/png'}),'after.png');
 const upload=await fetch(f.base+'/api/worker/orders/'+f.order1+'/photos',{method:'POST',headers:{origin:f.base,cookie,'x-assignment-version':version},body:form});assert.equal(upload.status,200,JSON.stringify(await upload.json()));
 assert.equal((await post('/api/worker/orders/'+f.order1,{action:'complete',version},cookie)).status,200);
 await post('/api/worker/logout',{},cookie);assert.equal((await fetch(f.base+'/api/worker/orders',{headers:{cookie}})).status,401);
});
test('hasło robocze blokuje dane; zmiana hasła unieważnia starą sesję',async()=>{
 const login=await post('/api/worker/login',{login:'kamil',password:f.testPassword});const cookie=login.headers.get('set-cookie')!.split(';')[0];assert.equal((await fetch(f.base+'/api/worker/orders',{headers:{cookie}})).status,403);
 assert.equal((await post('/api/worker/password',{currentPassword:f.testPassword,password:'Changed-fixture-password-123!'},cookie)).status,200);
 assert.equal((await fetch(f.base+'/api/worker/me',{headers:{cookie}})).status,401);assert.equal((await post('/api/worker/login',{login:'kamil',password:f.testPassword})).status,401);
 assert.equal((await post('/api/worker/login',{login:'kamil',password:'Changed-fixture-password-123!'})).status,200);
});
