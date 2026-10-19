// Test-only PostgREST adapter over a real embedded Postgres. Never imported by the app.
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
export async function crewFixture(port=0){
 process.env.SUPABASE_URL='https://crew-fixture.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-service';process.env.COOKIE_SECRET='fixture-cookie-secret-that-is-at-least-32';process.env.IP_HASH_SECRET='fixture-ip-secret';process.env.ADMIN_EMAILS='owner@example.invalid';
 const pg=new PGlite();await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 for(const name of ['001_orders.sql','003_attachment_limit.sql','004_offers_and_retention.sql','005_manual_mail.sql','20261016180000_owner_notifications.sql','20261017094831_internal_scheduling.sql','20261019063107_crew_calendar.sql'])await pg.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 const nativeFetch=globalThis.fetch;
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));if(url.hostname!=='crew-fixture.invalid')return nativeFetch(input,init);
  try{
   if(url.pathname==='/auth/v1/user')return Response.json({id:randomUUID(),email:'owner@example.invalid'});
   if(url.pathname==='/auth/v1/token')return Response.json({access_token:Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:'00000000-0000-4000-8000-000000000001',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture',expires_in:3600,refresh_token:'fixture-refresh-token',token_type:'bearer',user:{id:randomUUID(),email:'owner@example.invalid'}});
   if(url.pathname.startsWith('/storage/'))return Response.json({Key:'test',signedURL:'/object/sign/grave-photos/test?token=fixture'});
   const body=init?.body?JSON.parse(String(init.body)):null;
   if(url.pathname.includes('/rpc/')){const fn=url.pathname.split('/').pop()!;if(!/^[a-z_]+$/.test(fn))throw new Error('INVALID_FUNCTION');const keys=Object.keys(body||{});const args=keys.map(k=>body[k]&&typeof body[k]==='object'?JSON.stringify(body[k]):body[k]);const result=await pg.query<any>(`select public.${fn}(${keys.map((k,i)=>k+'=> $'+(i+1)).join(',')}) as value`,args);return Response.json(result.rows[0]?.value??null);}
   const table=url.pathname.split('/').pop()!;if(!/^[a-z_]+$/.test(table))throw new Error('INVALID_TABLE');const params:any[]=[];const where:string[]=[];
   for(const [key,value] of url.searchParams){if(['select','order','limit','or'].includes(key))continue;if(!/^[a-z_]+$/.test(key))throw new Error('INVALID_COLUMN');const dot=value.indexOf('.');const op=value.slice(0,dot);const v=value.slice(dot+1);const operators:Record<string,string>={eq:'=',gt:'>',gte:'>=',lt:'<',lte:'<=',neq:'<>'};if(!operators[op])throw new Error('INVALID_FILTER');params.push(v==='true'?true:v==='false'?false:v);where.push(`${key}${operators[op]}$${params.length}`);}
   const filter=where.length?' where '+where.join(' and '):'';let rows:any[]=[];
   if(init?.method==='POST'){const values=Array.isArray(body)?body:[body];for(const row of values){const keys=Object.keys(row);const q=await pg.query<any>(`insert into ${table}(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,keys.map(k=>typeof row[k]==='object'&&row[k]!==null?JSON.stringify(row[k]):row[k]));rows.push(...q.rows);}}
   else if(init?.method==='PATCH'){const keys=Object.keys(body);const off=params.length;params.push(...keys.map(k=>typeof body[k]==='object'&&body[k]!==null?JSON.stringify(body[k]):body[k]));rows=(await pg.query<any>(`update ${table} set ${keys.map((k,i)=>k+'=$'+(off+i+1)).join(',')}${filter} returning *`,params)).rows;}
   else if(init?.method==='DELETE')rows=(await pg.query<any>(`delete from ${table}${filter} returning *`,params)).rows;
   else{const select=url.searchParams.get('select')||'*';if(!/^[a-z_,*]+$/.test(select))throw new Error('INVALID_SELECT');const order=url.searchParams.get('order');rows=(await pg.query<any>(`select ${select} from ${table}${filter}${order&&/^[a-z_]+\.(asc|desc)$/.test(order)?' order by '+order.replace('.',' '):''}`,params)).rows;}
   rows=rows.map(row=>({...row,...(row.date instanceof Date?{date:row.date.toISOString().slice(0,10)}:{})}));
   const headers=new Headers(init?.headers);if(headers.get('accept')?.includes('object+json'))return rows.length?Response.json(rows[0]):Response.json(null,{status:406});return Response.json(rows);
  }catch(e){return Response.json({message:e instanceof Error?e.message:String(e),code:'FIXTURE_SQL'},{status:400});}
 };
 const {passwordHash}=await import('../server/crew');const worker1=randomUUID(),worker2=randomUUID(),cem=randomUUID();const testPassword='Fixture-password-123!';const hash=await passwordHash(testPassword,'test-salt');
 await pg.query('insert into workers(id,login,name,password_hash,password_salt,must_change_password) values($1,$2,$3,$4,$5,false),($6,$7,$8,$4,$5,true)',[worker1,'szymon','Szymon',hash,'test-salt',worker2,'kamil','Kamil']);
 await pg.query('insert into cemeteries(id,name,address) values($1,$2,$3)',[cem,'Cmentarz testowy','Warszawa — środowisko testowe']);
 const {localDate}=await import('../shared/domain');const today=localDate();await pg.query('insert into team_days(date,capacity) values($1,20)',[today]);await pg.query('insert into cemetery_days(date,cemetery_id) values($1,$2)',[today,cem]);
 const order1=randomUUID(),order2=randomUUID();for(const [id,worker] of [[order1,worker1],[order2,worker2]]){
  await pg.query(`insert into orders(id,idempotency_key,payload_hash,source,cemetery_id,date,package_snapshot,cemetery_snapshot,documents_snapshot,customer,grave_details,status,weight,terms_accepted,early_start,upload_secret_hash,contract_at) values($1,$2,'fixture','phone',$3,$4,$5,$6,'{}',$7,$8,'scheduled',1,true,false,'fixture',now())`,[id,randomUUID(),cem,today,JSON.stringify({id:'silver',name:'Silver',price:19900,deposit:5000,features:['Ręczne mycie nagrobka','Zdjęcia przed i po']}),JSON.stringify({id:cem,name:'Cmentarz testowy',address:'Warszawa — środowisko testowe'}),JSON.stringify({name:'Klient testowy',email:'secret@example.invalid',phone:'+48600000000'}),JSON.stringify({inscription:'Nagrobek testowy',location:'Od głównej bramy druga alejka w prawo.',sector:'A',row:'2',grave:'10'})]);
  await pg.query("select assign_worker($1,$2,'fixture')",[id,worker]);
 }
 const {default:app}=await import('../server/index');const server=app.listen(port,'127.0.0.1');await new Promise<void>(resolve=>server.on('listening',resolve));const address=server.address() as any;const base=`http://127.0.0.1:${address.port}`;process.env.APP_ORIGIN=base;
 return {pg,base,worker1,worker2,order1,order2,testPassword,close:async()=>{globalThis.fetch=nativeFetch;await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await pg.close();}};
}
if(process.env.CREW_BROWSER_FIXTURE==='1'){const f=await crewFixture(3007);console.log('Test-only crew fixture: '+f.base);}
