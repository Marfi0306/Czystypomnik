import {db,rpc} from './db';
// Ta operacja nie zmienia kopii w Gmail ani na urządzeniach. Obowiązuje też procedura operacyjna.
export async function runRetention(){
 if(!db||process.env.OPERATIONS_CONFIRMED!=='true')throw new Error('NOT_READY');
 const expired=await db.from('worker_sessions').delete().lt('expires_at',new Date().toISOString());if(expired.error)throw new Error('DATABASE_UNAVAILABLE');
 const jobs=await rpc('retention_candidates');let removed=0;
 for(const job of jobs){
  if(job.paths.length){const {error}=await db.storage.from('grave-photos').remove(job.paths);if(error)throw new Error('RETENTION_STORAGE_FAILED');}
  await rpc('finish_retention',{p_id:job.id,p_delete_order:job.deleteOrder});removed++;
 }
 return {processed:removed};
}
