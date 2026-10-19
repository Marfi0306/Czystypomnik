import {Router,type Request,type Response} from 'express';
import {randomBytes,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import multer from 'multer';
import sharp from 'sharp';
import {z} from 'zod';
import {db,rpc} from './db';
const scrypt=promisify(scryptCallback);
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
export async function passwordHash(password:string,salt:string){return (await scrypt(password,salt,64) as Buffer).toString('hex');}
const wrap=(fn:(req:Request,res:Response,next:any)=>Promise<unknown>)=>(req:Request,res:Response,next:any)=>{void fn(req,res,next).catch(next);};
type SessionWorker={id:string;name:string;login:string;must_change_password:boolean;active:boolean};
export async function workerActor(req:Request,allowPasswordChange=false):Promise<SessionWorker>{
 if(!db)throw new Error('NOT_READY');const token=req.cookies.cp_crew;if(typeof token!=='string'||token.length!==64)throw new Error('UNAUTHORIZED');
 const {data:s,error}=await db.from('worker_sessions').select('worker_id').eq('token_hash',digest(token)).gt('expires_at',new Date().toISOString()).maybeSingle();if(error||!s)throw new Error('UNAUTHORIZED');
 const {data:w,error:e}=await db.from('workers').select('id,name,login,must_change_password,active').eq('id',s.worker_id).eq('active',true).maybeSingle();if(e||!w)throw new Error('UNAUTHORIZED');
 if(w.must_change_password&&!allowPasswordChange)throw new Error('PASSWORD_CHANGE_REQUIRED');return w;
}
const cookie={httpOnly:true,sameSite:'strict' as const,secure:process.env.NODE_ENV==='production',maxAge:12*3600000,path:'/api/worker'};
export function crewRouter(origin:any,rate:(req:Request,kind:string)=>Promise<void>){const router=Router();
 router.post('/login',origin,wrap(async(req,res)=>{
  if(!db)throw new Error('NOT_READY');await rate(req,'crew-login');const b=z.object({login:z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,40}$/),password:z.string().min(1).max(200)}).parse(req.body);
  const {data:w,error}=await db.from('workers').select('*').eq('login',b.login).maybeSingle();if(error)throw new Error('DATABASE_UNAVAILABLE');
  const actual=await passwordHash(b.password,w?.password_salt||'unavailable-account-constant-salt');const expected=w?.password_hash||'0'.repeat(128);
  if(!w?.active||expected.length!==128||!timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected,'hex')))throw new Error('UNAUTHORIZED');
  const token=randomBytes(32).toString('hex');const {error:e}=await db.from('worker_sessions').insert({token_hash:digest(token),worker_id:w.id,expires_at:new Date(Date.now()+cookie.maxAge).toISOString()});if(e)throw new Error('DATABASE_UNAVAILABLE');
  res.cookie('cp_crew',token,cookie).json({name:w.name,mustChangePassword:w.must_change_password});
 }));
 router.get('/me',wrap(async(req,res)=>{const w=await workerActor(req,true);res.json({name:w.name,login:w.login,mustChangePassword:w.must_change_password});}));
 router.post('/password',origin,wrap(async(req,res)=>{const w=await workerActor(req,true);await rate(req,'crew-password');const b=z.object({currentPassword:z.string().min(1).max(200),password:z.string().min(16).max(200)}).refine(b=>b.password!==b.currentPassword).parse(req.body);
  const {data:old,error}=await db!.from('workers').select('password_hash,password_salt').eq('id',w.id).single();if(error)throw new Error('DATABASE_UNAVAILABLE');const current=await passwordHash(b.currentPassword,old.password_salt);if(!timingSafeEqual(Buffer.from(current,'hex'),Buffer.from(old.password_hash,'hex')))throw new Error('UNAUTHORIZED');
  const salt=randomBytes(24).toString('hex');await rpc('crew_password',{p_worker:w.id,p_old_hash:old.password_hash,p_hash:await passwordHash(b.password,salt),p_salt:salt});res.clearCookie('cp_crew',{path:cookie.path}).json({ok:true});
 }));
 router.post('/logout',origin,wrap(async(req,res)=>{if(db&&typeof req.cookies.cp_crew==='string'){const {error}=await db.from('worker_sessions').delete().eq('token_hash',digest(req.cookies.cp_crew));if(error)throw new Error('DATABASE_UNAVAILABLE');}res.clearCookie('cp_crew',{path:cookie.path}).json({ok:true});}));
 router.get('/orders',wrap(async(req,res)=>{const w=await workerActor(req);res.json({orders:await rpc('crew_orders',{p_worker:w.id})});}));
 router.get('/orders/:id',wrap(async(req,res)=>{const w=await workerActor(req);const id=z.uuid().parse(req.params.id);const orders=await rpc('crew_orders',{p_worker:w.id});const order=orders.find((o:any)=>o.id===id);if(!order)throw new Error('NOT_FOUND');
  const {data,error}=await db!.from('attachments').select('id,path,kind').eq('order_id',id).or(`kind.eq.reference,assignment_version.eq.${order.assignment_version}`);if(error)throw new Error('DATABASE_UNAVAILABLE');
  const photos=await Promise.all(data.map(async p=>{const {data,error}=await db!.storage.from('grave-photos').createSignedUrl(p.path,60);if(error)throw new Error('PHOTO_UNAVAILABLE');return {id:p.id,kind:p.kind,url:data.signedUrl};}));
  // Recheck after signing: a concurrent reassignment must revoke the response as well.
  await rpc('crew_check',{p_worker:w.id,p_order:id,p_version:order.assignment_version});res.json({order,photos});
 }));
 router.post('/orders/:id',origin,wrap(async(req,res)=>{const w=await workerActor(req);const b=z.object({action:z.enum(['accept','decline','complete']),version:z.uuid(),reason:z.string().max(1000).default('')}).strict().parse(req.body);await rpc('crew_change',{p_worker:w.id,p_order:z.uuid().parse(req.params.id),p_version:b.version,p_action:b.action,p_reason:b.reason});res.json({ok:true});}));
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:3*1024*1024,files:1,fields:0}});
 router.post('/orders/:id/photos',origin,wrap(async(req,res,next)=>{const w=await workerActor(req);await rate(req,'crew-photo');const id=z.uuid().parse(req.params.id);const version=z.uuid().parse(req.get('x-assignment-version'));await rpc('crew_check',{p_worker:w.id,p_order:id,p_version:version});res.locals.worker=w.id;res.locals.order=id;res.locals.version=version;next();}),upload.single('photo'),wrap(async(req,res)=>{
  if(!req.file)throw new Error('INVALID_FILE');const image=sharp(req.file.buffer,{limitInputPixels:40000000});const meta=await image.metadata();if(!['jpeg','png','webp'].includes(meta.format||'')||(meta.pages||1)>1)throw new Error('INVALID_FILE');
  const clean=await image.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();const path=`${res.locals.order}/completion/${res.locals.version}/${randomBytes(16).toString('hex')}.webp`;
  const result=await db!.storage.from('grave-photos').upload(path,clean,{contentType:'image/webp',upsert:false});if(result.error)throw new Error('UPLOAD_FAILED');
  try{await rpc('crew_photo',{p_worker:res.locals.worker,p_order:res.locals.order,p_version:res.locals.version,p_path:path,p_size:clean.length});}catch(e){await db!.storage.from('grave-photos').remove([path]);throw e;}res.json({ok:true});
 }));return router;}
