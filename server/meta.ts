import type {Request} from 'express';
import {isIP} from 'node:net';
import {marketingBatchSchema,type MarketingEvent} from '../shared/marketing';

export type MetaDelivery={state:'disabled'|'no_consent'|'sent'|'failed'};
// Only a validated, successfully saved public lead can enter this server channel.
export async function sendMetaLead(req:Request,submissionId:string):Promise<MetaDelivery>{
 if(!/^[a-f0-9-]{36}$/i.test(submissionId))return {state:'failed'};
 return dispatch(req,[{event_name:'Lead',event_id:'cp-lead-'+submissionId}]);
}
export async function sendMetaEvents(req:Request,events:MarketingEvent[]):Promise<MetaDelivery>{
 const parsed=marketingBatchSchema.safeParse({events});if(!parsed.success)return {state:'failed'};
 return dispatch(req,parsed.data.events.map(event=>({event_name:event.name,event_id:event.id,...(Object.keys(event.data).length?{custom_data:event.data}:{})})));
}
type MetaEvent={event_name:string;event_id:string;custom_data?:Record<string,unknown>};
async function dispatch(req:Request,events:MetaEvent[]):Promise<MetaDelivery>{
 const token=process.env.META_CONVERSIONS_API_TOKEN;const pixel=process.env.META_PIXEL_ID;
 const report=(state:MetaDelivery['state'],details:Record<string,unknown>={})=>{console.info('META_CAPI_DELIVERY',{state,events:events.map(e=>({name:e.event_name,id:e.event_id})),...details});return {state};};
 if(!token||!pixel||!/^\d{5,25}$/.test(pixel)||process.env.APP_MODE!=='production')return report('disabled');
 if(req.get('x-marketing-consent')!=='v2')return report('no_consent');
 try{
  const origin=new URL(process.env.APP_ORIGIN||'');if(origin.protocol!=='https:')return report('failed');
  const user:Record<string,string>={client_user_agent:(req.get('user-agent')||'').slice(0,1000)};
  if(req.ip&&isIP(req.ip))user.client_ip_address=req.ip;
  for(const key of ['fbp','fbc']){const value=req.cookies?.['_'+key];if(typeof value==='string'&&/^fb\.\d+\.\d{10,16}\.[A-Za-z0-9_-]{1,500}$/.test(value))user[key]=value;}
  const version=/^v\d+\.0$/.test(process.env.META_GRAPH_API_VERSION||'')?process.env.META_GRAPH_API_VERSION!:'v26.0';
  const body:Record<string,unknown>={data:events.map(event=>({...event,event_time:Math.floor(Date.now()/1000),action_source:'website',event_source_url:origin.origin+'/',user_data:user}))};
  if(process.env.META_TEST_EVENT_CODE)body.test_event_code=process.env.META_TEST_EVENT_CODE;
  const response=await fetch(`https://graph.facebook.com/${version}/${pixel}/events`,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(3500)});
  const result=await response.json();
  if(!response.ok||result.events_received!==events.length)return report('failed',{status:response.status,code:typeof result.error?.code==='number'?result.error.code:undefined});
  return report('sent',{received:result.events_received});
 }catch{return report('failed');}
}
