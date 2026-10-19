// Only explicit, current marketing consent allows loading any Meta resource.
const consentKey='cp_marketing_consent_v1';
const maxAge=180*86400000;
type Consent={version:1;pixelId:string;marketing:boolean;at:number};
type Fbq=((...args:unknown[])=>void)&{queue?:unknown[][];callMethod?:(...args:unknown[])=>void;push?:Fbq;loaded?:boolean;version?:string};
let pixelId='';let initialized='';let currentChoice:Consent|undefined;let listening=false;const sent=new Set<string>();
const publicPage=()=>window.location.pathname==='/';
export function marketingPixelId(){return pixelId;}
export function marketingConsent():Consent|null{try{const c=currentChoice||JSON.parse(localStorage.getItem(consentKey)||'null');return c?.version===1&&c.pixelId===pixelId&&typeof c.marketing==='boolean'&&typeof c.at==='number'&&c.at<=Date.now()&&Date.now()-c.at<maxAge?c:null;}catch{return null;}}
function notify(){window.dispatchEvent(new Event('cp:marketing-consent'));}
function removeCookies(){const host=window.location.hostname;const domains=['',host,'.'+host];const parts=host.split('.');if(parts.length>2)domains.push('.'+parts.slice(1).join('.'));for(const name of ['_fbp','_fbc'])for(const domain of domains)document.cookie=`${name}=; Max-Age=0; Path=/; SameSite=Lax${domain?'; Domain='+domain:''}`;}
function fbq(){return (window as Window&{fbq?:Fbq}).fbq;}
function revoke(){const q=fbq();if(q?.queue&&!q.callMethod){q.queue=[];initialized='';}q?.('consent','revoke');removeCookies();}
function start(){
 if(!pixelId||!publicPage()||marketingConsent()?.marketing!==true)return;
 if(initialized===pixelId){fbq()?.('consent','grant');return;}
 const w=window as Window&{fbq?:Fbq;_fbq?:Fbq};
 if(!w.fbq){const q:Fbq=function(...args:unknown[]){if(q.callMethod)q.callMethod(...args);else q.queue!.push(args);};q.queue=[];q.push=q;q.loaded=true;q.version='2.0';w.fbq=q;w._fbq=q;}
 w.fbq('consent','grant');w.fbq('set','autoConfig',false,pixelId);w.fbq('init',pixelId);initialized=pixelId;
 if(!document.getElementById('cp-meta-pixel')){const script=document.createElement('script');script.id='cp-meta-pixel';script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';document.head.appendChild(script);}
 // No PageView, automatic form events or advanced matching. Only the successful Lead below.
}
export function configureMarketing(id:string|undefined){if(!listening){window.addEventListener('storage',event=>{if(event.key!==consentKey&&event.key!==null)return;currentChoice=undefined;if(marketingConsent()?.marketing===true)start();else revoke();notify();});listening=true;}const next=publicPage()&&id&&/^\d{5,25}$/.test(id)?id:'';if(next!==pixelId){currentChoice=undefined;if(initialized)fbq()?.('consent','revoke');pixelId=next;notify();}if(!publicPage()){if(initialized)fbq()?.('consent','revoke');return;}start();}
export function saveMarketingConsent(marketing:boolean){if(!pixelId)return;currentChoice={version:1,pixelId,marketing,at:Date.now()};try{localStorage.setItem(consentKey,JSON.stringify(currentChoice));}catch{/* The explicit choice applies to this page only if storage is blocked. */}
 if(marketing&&marketingConsent()?.marketing===true)start();else revoke();notify();
}
export function trackSavedLead(submissionId:string){
 try{
  if(!pixelId||!publicPage()||marketingConsent()?.marketing!==true||!/^[-a-zA-Z0-9]{10,100}$/.test(submissionId))return;
  const key='cp_meta_lead_'+submissionId;if(sent.has(key))return;try{if(sessionStorage.getItem(key))return;}catch{/* In-memory deduplication remains available. */}
  start();const send=fbq();if(!send)return;send('trackSingle',pixelId,'Lead',{}, {eventID:'cp-lead-'+submissionId});sent.add(key);try{sessionStorage.setItem(key,'1');}catch{/* Do not affect form submission. */}
 }catch{/* Marketing must never change the result of saving the customer's form. */}
}
