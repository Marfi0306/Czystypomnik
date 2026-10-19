import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import sharp from 'sharp';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { db, readySettings, rpc } from './db';
import { processOutbox, messageFor, ownerDelivery } from './mail';
import { orderSchema } from '../shared/domain';
import { termsStatement } from '../shared/consent';
import {offerSchema,contractSchema} from '../shared/offers';
import {runRetention} from './retention';
import {crewRouter} from './crew';
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));
app.use(express.json({ limit: '32kb' })); app.use(cookieParser(process.env.COOKIE_SECRET));
app.use((req,res,next) => { const pixelDocument=req.path==='/';res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': `default-src 'self'; img-src 'self' blob: data: https://*.supabase.co${pixelDocument?" https://www.facebook.com":""}; script-src 'self'${pixelDocument?" https://connect.facebook.net":""}; style-src 'self' 'unsafe-inline'; connect-src 'self'${pixelDocument?" https://www.facebook.com":""}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` }); next(); });
const wrap = (fn: (req: Request,res: Response,next: NextFunction) => Promise<unknown>) => (req: Request,res: Response,next: NextFunction) => { Promise.resolve(fn(req,res,next)).catch(next); };
app.get('/api/health',wrap(async(_req,res)=>{
 if(!db){res.status(503).json({status:'unavailable',database:'not-configured'});return;}
 const {error}=await db.from('settings').select('id').eq('id',true).single();
 res.status(error?503:200).json({status:error?'unavailable':'ok',database:error?'unavailable':'connected'});
}));
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const uploadToken = (key: string) => createHmac('sha256',process.env.UPLOAD_SECRET || '').update(key).digest('hex');
const same = (a: string,b: string) => { const x=Buffer.from(a); const y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y); };
async function withDeclarations(input: {packageId:string;earlyStart:boolean}) {
 const {data,error}=await db!.from('packages').select('price,deposit,version').eq('id',input.packageId).single();
 if(error)throw new Error('PACKAGE_UNAVAILABLE');
 return {...input,expectedPackageVersion:data.version,declarations:{terms:termsStatement,earlyStart:null}};
}
function origin(req: Request,res: Response,next: NextFunction) { if (req.get('origin') !== process.env.APP_ORIGIN) { res.status(403).json({ error: 'ORIGIN_DENIED' }); return; } next(); }
async function actor(req: Request) {
  if (!db) throw new Error('NOT_READY');
  const token=req.signedCookies.cp_session;
  if (typeof token !== 'string') throw new Error('UNAUTHORIZED');
  const { data,error }=await db.auth.getUser(token);
  const allowed=(process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map(v=>v.trim());
  if (error || !data.user?.email || !allowed.includes(data.user.email.toLowerCase())) throw new Error('UNAUTHORIZED');
  return data.user.email;
}
async function rate(req: Request, kind: string) {
  if (!process.env.IP_HASH_SECRET) throw new Error('NOT_READY');
  const key = createHmac('sha256',process.env.IP_HASH_SECRET).update(`${kind}:${req.ip}`).digest('hex');
  if (!await rpc('take_rate',{ p_key:key })) throw new Error('RATE_LIMIT');
}
app.use('/api/worker',crewRouter(origin,rate));
app.get('/api/config',wrap(async (_req,res)=>{
  const s=await readySettings();
  if (!s) { res.json({ mode:'demo' }); return; }
  const [p,c]=await Promise.all([db!.from('packages').select('id,name,price,deposit,weight,description,features').eq('active',true).order('price'),db!.from('cemeteries').select('id,name,address').eq('active',true).order('name')]);
  if(p.error||c.error) throw new Error('DATABASE_UNAVAILABLE');
  res.json({mode:'production',packages:p.data,cemeteries:c.data,business:s.business,documents:s.documents,documentsVersion:s.documents_version,documentsApproved:true,mailMode:process.env.MAIL_MODE,tracking:{metaPixelId:/^\d{5,25}$/.test(process.env.META_PIXEL_ID||'')?process.env.META_PIXEL_ID:''}});
}));
app.get('/api/availability',wrap(async(req,res)=>{
  if(!await readySettings()) throw new Error('NOT_READY');
  const cemetery=z.uuid().parse(req.query.cemetery); const pkg=z.string().max(80).parse(req.query.package);
  res.json(await rpc('availability',{p_cemetery:cemetery,p_package:pkg}));
}));
app.post('/api/orders',origin,wrap(async(req,res)=>{
  if(!await readySettings()) throw new Error('NOT_READY');
  await rate(req,'order'); const input=orderSchema.parse(req.body); const secret=uploadToken(input.idempotencyKey);
  const order=await rpc('reserve_order',{p_input:await withDeclarations(input),p_hash:hash(JSON.stringify(input)),p_upload_hash:hash(secret)});
  res.status(201).json({...order,uploadToken:secret,emailQueued:process.env.MAIL_MODE==='resend'});
}));
const upload=multer({ storage:multer.memoryStorage(),limits:{fileSize:3*1024*1024,files:1,fields:0} });
app.post('/api/orders/:id/photos',origin,wrap(async(req,res,next)=>{
  if(!await readySettings()) throw new Error('NOT_READY');
  await rate(req,'photo');
  const id=z.uuid().parse(req.params.id); const secret=req.get('x-upload-token') || '';
  const {data:o,error}=await db!.from('orders').select('id,upload_secret_hash,upload_expires_at').eq('id',id).single();
  if(error || !o || !same(hash(secret),o.upload_secret_hash) || Date.parse(o.upload_expires_at)<Date.now()) throw new Error('UNAUTHORIZED');
  res.locals.orderId=id; next();
}),upload.array('photos',1),wrap(async(req,res)=>{
  const id=res.locals.orderId as string; const files=req.files as Express.Multer.File[];
  if(!files?.length) throw new Error('INVALID_FILE');
  // Advisory lock in attachment RPC also guards concurrent attempts.
  const paths:string[]=[];
  try {
    for(const file of files) {
      const img=sharp(file.buffer,{limitInputPixels:40000000}); const meta=await img.metadata();
      if(!['jpeg','png','webp'].includes(meta.format || '') || (meta.pages || 1)>1) throw new Error('INVALID_FILE');
      const clean=await img.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
      const path=`${id}/${hash(clean.toString('base64'))}.webp`;
      const result=await db!.storage.from('grave-photos').upload(path,clean,{contentType:'image/webp',upsert:false});
      if(result.error) { const existing=await db!.from('attachments').select('id').eq('path',path).maybeSingle(); if(existing.data) continue; throw new Error('UPLOAD_FAILED'); }
      paths.push(path);
      try { await rpc('attach_photo',{p_order:id,p_path:path,p_size:clean.length}); }
      catch(e) { await db!.storage.from('grave-photos').remove([path]); throw e; }
    }
    res.json({added:paths.length});
  } catch(e) { throw e; }
}));
app.post('/api/admin/login',origin,wrap(async(req,res)=>{
  if(!db || !process.env.ADMIN_EMAILS || (process.env.COOKIE_SECRET||'').length<32) throw new Error('NOT_READY');
  await rate(req,'login');
  const {email,password}=z.object({email:z.email(),password:z.string().min(1).max(200)}).parse(req.body);
  // Osobny klient: sesja administratora nie może podmienić serwerowego service_role.
  const authClient=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await authClient.auth.signInWithPassword({email,password});
  if(error||!data.session||!(process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map(v=>v.trim()).includes(email.toLowerCase())) throw new Error('UNAUTHORIZED');
  res.cookie('cp_session',data.session.access_token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',signed:true,maxAge:Math.min(data.session.expires_in,3600)*1000,path:'/api/admin'}).json({ok:true});
}));
app.post('/api/admin/password',origin,wrap(async(req,res)=>{
 await actor(req);const {password}=z.object({password:z.string().min(16).max(200)}).parse(req.body);
 const {data,error}=await db!.auth.getUser(req.signedCookies.cp_session);if(error||!data.user)throw new Error('UNAUTHORIZED');
 const result=await db!.auth.admin.updateUserById(data.user.id,{password});if(result.error)throw new Error('SERVICE_UNAVAILABLE');
 res.clearCookie('cp_session',{path:'/api/admin'}).json({ok:true});
}));
// Jednorazowe utworzenie pierwszego uprawnionego operatora. Brak tokenu wyłącza endpoint.
app.post('/api/internal/setup-admin',wrap(async(req,res)=>{
 if(!db||(process.env.ADMIN_SETUP_TOKEN||'').length<32||!same(req.get('authorization')||'',`Bearer ${process.env.ADMIN_SETUP_TOKEN}`))throw new Error('UNAUTHORIZED');
 const body=z.object({email:z.email(),password:z.string().min(16).max(200)}).strict().parse(req.body);
 if(!(process.env.ADMIN_EMAILS||'').toLowerCase().split(',').map(v=>v.trim()).includes(body.email.toLowerCase()))throw new Error('UNAUTHORIZED');
 const {data,error}=await db.auth.admin.listUsers({page:1,perPage:1});if(error)throw new Error('SERVICE_UNAVAILABLE');
 if(data.users.length)throw new Error('INVALID_TRANSITION');
 const created=await db.auth.admin.createUser({email:body.email,password:body.password,email_confirm:true});
 if(created.error)throw new Error('SERVICE_UNAVAILABLE');res.json({ok:true});
}));
app.post('/api/admin/logout',origin,(req,res)=>{res.clearCookie('cp_session',{path:'/api/admin'}).json({ok:true});});
app.get('/api/admin/orders',wrap(async(req,res)=>{
  await actor(req);
  const {data,error}=await db!.from('orders').select('id,number,date,status,source,customer,cemetery_snapshot,package_snapshot,grave_details,notes,internal_note,attention,followup_at,payment_status,deposit_received,deposit_refunded,created_at,worker_id,assignment_state,assignment_version,work_completed_at').order('created_at',{ascending:false}).limit(1000);
  if(error) throw new Error('DATABASE_UNAVAILABLE');
  const [mail, cem, pkg]=await Promise.all([db!.from('outbox').select('id,order_id,state,attempts,last_error,kind,recipient').neq('state','sent').limit(1000),db!.from('cemeteries').select('*'),db!.from('packages').select('*')]);
  if(mail.error||cem.error||pkg.error) throw new Error('DATABASE_UNAVAILABLE');
  res.json({orders:data,outbox:mail.data,cemeteries:cem.data,packages:pkg.data});
}));
app.get('/api/admin/orders/:id',wrap(async(req,res)=>{
  await actor(req); const id=z.uuid().parse(req.params.id);
  const [o,a,h,offers]=await Promise.all([db!.from('orders').select('*').eq('id',id).single(),db!.from('attachments').select('*').eq('order_id',id),db!.from('history').select('*').eq('order_id',id).order('created_at'),db!.from('offers').select('*').eq('order_id',id).order('created_at',{ascending:false})]);
  if(o.error||a.error||h.error||offers.error) throw new Error('NOT_FOUND');
  const photos=await Promise.all(a.data.map(async f=>{const {data,error}=await db!.storage.from('grave-photos').createSignedUrl(f.path,300); if(error) throw new Error('PHOTO_UNAVAILABLE'); return {id:f.id,url:data.signedUrl};}));
  res.json({order:o.data,photos,history:h.data,offers:offers.data});
}));
app.get('/api/admin/team',wrap(async(req,res)=>{await actor(req);const {data,error}=await db!.from('workers').select('id,name,login,email,active').order('name');if(error)throw new Error('DATABASE_UNAVAILABLE');res.json({workers:data});}));
app.post('/api/admin/team/:id',origin,wrap(async(req,res)=>{const user=await actor(req);const b=z.object({email:z.union([z.email(),z.literal('')]),active:z.boolean()}).strict().parse(req.body);await rpc('configure_worker',{p_worker:z.uuid().parse(req.params.id),p_email:b.email,p_active:b.active,p_actor:user});res.json({ok:true});}));
app.post('/api/admin/orders/:id/worker',origin,wrap(async(req,res)=>{const user=await actor(req);const b=z.object({workerId:z.uuid().nullable()}).strict().parse(req.body);await rpc('assign_worker',{p_order:z.uuid().parse(req.params.id),p_worker:b.workerId,p_actor:user});res.json({ok:true});}));
app.get('/api/admin/calendar',wrap(async(req,res)=>{await actor(req);const b=z.object({from:z.iso.date(),to:z.iso.date()}).refine(b=>b.to>=b.from&&(Date.parse(b.to)-Date.parse(b.from))<=62*86400000).parse(req.query);
 const [o,t,w]=await Promise.all([db!.from('orders').select('id,number,date,status,worker_id,assignment_state,assignment_version,work_completed_at,cemetery_snapshot,package_snapshot,grave_details,notes').gte('date',b.from).lte('date',b.to).order('number').limit(2000),db!.from('team_days').select('*').gte('date',b.from).lte('date',b.to),db!.from('workers').select('id,name,login,email,active').order('name')]);if(o.error||t.error||w.error)throw new Error('DATABASE_UNAVAILABLE');res.json({orders:o.data,days:t.data,workers:w.data});}));
const changeSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('assign'),data:z.object({date:z.iso.date()})}),
 z.object({action:z.literal('offer'),data:offerSchema}),
 z.object({action:z.literal('contract'),data:contractSchema}),
 z.object({action:z.literal('hold'),data:z.object({reason:z.string().trim().min(10).max(1000)})}),
 z.object({action:z.literal('release_hold'),data:z.object({message:z.string().trim().min(10).max(1000)})}),
 z.object({action:z.literal('status'),data:z.object({status:z.enum(['scheduled','in_progress','completed','rejected','cancelled','expired']),message:z.string().max(2000).default(''),deliveryEmailId:z.string().max(500).default(''),deliveryEvidence:z.string().max(8000).default(''),receivedAt:z.union([z.iso.datetime({offset:true}),z.literal('')]).default(''),paidAmount:z.number().int().nonnegative().default(0),paymentVerified:z.boolean().default(false)})}),
 z.object({action:z.literal('move'),data:z.object({date:z.iso.date(),cemeteryId:z.uuid(),message:z.string().min(3).max(2000),agreementEmail:z.string().trim().min(30).max(8000)})}),
 z.object({action:z.enum(['deposit','refund']),data:z.object({message:z.string().max(2000).default('')})}),
 z.object({action:z.literal('note'),data:z.object({note:z.string().max(4000),attention:z.string().max(200),followupAt:z.union([z.iso.datetime({offset:true}),z.literal('')])})}),
]);
app.post('/api/admin/orders/:id',origin,wrap(async(req,res)=>{const user=await actor(req); if(!await readySettings())throw new Error('NOT_READY'); const body=changeSchema.parse(req.body);await rpc('admin_change',{p_id:z.uuid().parse(req.params.id),p_action:body.action,p_data:body.data,p_actor:user});res.json({ok:true});}));
app.post('/api/admin/orders',origin,wrap(async(req,res)=>{
 const user=await actor(req);if(!await readySettings()) throw new Error('NOT_READY');const body=z.object({order:orderSchema,source:z.enum(['phone','meta'])}).parse(req.body);const secret=uploadToken(body.order.idempotencyKey);
 res.json(await rpc('reserve_order',{p_input:await withDeclarations(body.order),p_hash:hash(JSON.stringify(body.order)),p_upload_hash:hash(secret),p_source:body.source,p_actor:user}));
}));
app.post('/api/admin/days',origin,wrap(async(req,res)=>{
 const user=await actor(req);const b=z.object({date:z.iso.date(),cemeteryId:z.uuid().nullable(),capacity:z.number().int().nonnegative().nullable(),closed:z.boolean()}).parse(req.body);
 await rpc('configure_day',{p_date:b.date,p_cemetery:b.cemeteryId,p_capacity:b.capacity,p_closed:b.closed,p_actor:user});res.json({ok:true});
}));
app.get('/api/admin/days',wrap(async(req,res)=>{await actor(req);const [t,c]=await Promise.all([db!.from('team_days').select('*').order('date'),db!.from('cemetery_days').select('*').order('date')]);if(t.error||c.error) throw new Error('DATABASE_UNAVAILABLE');res.json({team:t.data,cemeteries:c.data});}));
app.post('/api/admin/cemeteries',origin,wrap(async(req,res)=>{await actor(req);const body=z.object({name:z.string().min(3).max(200),address:z.string().min(3).max(300)}).parse(req.body);const {error}=await db!.from('cemeteries').insert(body);if(error) throw new Error('DATABASE_UNAVAILABLE');res.json({ok:true});}));
app.post('/api/admin/packages',origin,wrap(async(req,res)=>{const user=await actor(req);const b=z.object({id:z.string().max(80),price:z.number().int().positive(),deposit:z.number().int().positive(),weight:z.number().int().positive(),active:z.boolean()}).refine(v=>v.deposit<=v.price).parse(req.body);await rpc('configure_package',{p_id:b.id,p_price:b.price,p_deposit:b.deposit,p_weight:b.weight,p_active:b.active,p_actor:user});res.json({ok:true});}));
app.get('/api/admin/outbox/:id',wrap(async(req,res)=>{
 await actor(req);if(process.env.MAIL_MODE!=='manual')throw new Error('NOT_READY');
 const {data,error}=await db!.from('outbox').select('id,recipient,kind,payload,state').eq('id',z.uuid().parse(req.params.id)).single();
 if(error||!data||!['pending','failed'].includes(data.state))throw new Error('INVALID_TRANSITION');
 res.json({id:data.id,recipient:data.recipient,...messageFor(data.kind,data.payload)});
}));
app.post('/api/admin/outbox/:id/sent',origin,wrap(async(req,res)=>{
 const user=await actor(req);if(process.env.MAIL_MODE!=='manual')throw new Error('NOT_READY');
 const body=z.object({messageId:z.string().trim().min(3).max(500),sentAt:z.iso.datetime({offset:true}),verified:z.literal(true)}).strict().parse(req.body);
 await rpc('record_manual_mail',{p_id:z.uuid().parse(req.params.id),p_message_id:body.messageId,p_sent_at:body.sentAt,p_actor:user});res.json({ok:true});
}));
app.post('/api/admin/outbox/:id/retry',origin,wrap(async(req,res)=>{const user=await actor(req);const id=z.uuid().parse(req.params.id);const {error}=await db!.from('outbox').update({state:'pending',attempts:0,next_attempt_at:new Date().toISOString()}).eq('id',id).eq('state','failed');if(error) throw new Error('DATABASE_UNAVAILABLE');await db!.from('history').insert({actor:user,event:'mail_retry',details:{id}});res.json({ok:true});}));
app.post('/api/internal/outbox',wrap(async(req,res)=>{if(!process.env.CRON_SECRET||!same(req.get('authorization')||'',`Bearer ${process.env.CRON_SECRET}`)) throw new Error('UNAUTHORIZED');if(!await readySettings()) throw new Error('NOT_READY');res.json(await processOutbox());}));
function ownerWorkerAuth(req:Request){if((process.env.OWNER_NOTIFY_SECRET||'').length<32||!same(req.get('authorization')||'',`Bearer ${process.env.OWNER_NOTIFY_SECRET}`))throw new Error('UNAUTHORIZED');}
app.post('/api/internal/owner-notifications',wrap(async(req,res)=>{ownerWorkerAuth(req);if(!await readySettings())throw new Error('NOT_READY');res.json(await processOutbox(true));}));
app.get('/api/internal/owner-notifications/:id',wrap(async(req,res)=>{ownerWorkerAuth(req);res.json(await ownerDelivery(z.uuid().parse(req.params.id)));}));
app.all('/api/internal/retention',wrap(async(req,res)=>{if(!process.env.CRON_SECRET||!same(req.get('authorization')||'',`Bearer ${process.env.CRON_SECRET}`))throw new Error('UNAUTHORIZED');res.json(await runRetention());}));
app.use('/api',(_req,res)=>{res.status(404).json({error:'NOT_FOUND'});});
app.use(express.static(resolve('dist')));
app.get('/{*path}',(_req,res)=>{res.sendFile(resolve('dist/index.html'));});
app.use((error: Error, _req:Request,res:Response,_next:NextFunction)=>{
 const known=['DATE_REQUIRED','MAIL_EVIDENCE_REQUIRED','NOT_READY','FULL','IDEMPOTENCY_CONFLICT','DOCUMENTS_CHANGED','PACKAGE_CHANGED','UNAUTHORIZED','RATE_LIMIT','PAST_DATE','INVALID_FILE','EARLY_START_REQUIRED','CAPACITY_BELOW_OCCUPANCY','TERMINAL_STATUS','INVALID_TRANSITION','NOT_ACCEPTED','OFFER_REQUIRED','OFFER_NOT_SENT','OFFER_EXPIRED','OFFER_INVALID','OFFER_SENDING','DELIVERY_REQUIRED','RETENTION_IN_PROGRESS','CONTRACT_EVIDENCE_REQUIRED','CONTRACT_REQUIRED','NO_DEPOSIT','ALREADY_REFUNDED','REASON_REQUIRED'];
 known.push('NOT_FOUND','PASSWORD_CHANGE_REQUIRED','WORK_DAY_REQUIRED','COMPLETION_PHOTO_REQUIRED');
 const code=known.find(v=>error.message.includes(v));
 res.setHeader('Cache-Control','no-store');res.status(error instanceof z.ZodError ? 400 : code==='UNAUTHORIZED'?401:code==='NOT_FOUND'?404:code==='PASSWORD_CHANGE_REQUIRED'?403:code==='RATE_LIMIT'?429:code==='NOT_READY'?503:code?409:500).json({error:code || (error instanceof z.ZodError?'VALIDATION_ERROR':error instanceof multer.MulterError?'INVALID_FILE':'SERVICE_UNAVAILABLE'),...(error instanceof z.ZodError?{fields:error.flatten().fieldErrors}:{})});
});
export default app;
