import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configureMarketing,marketingConsent,saveMarketingConsent,trackSavedLead} from '../src/marketing';
class Storage{data=new Map<string,string>();getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,v);}removeItem(k:string){this.data.delete(k);}}
const local=new Storage(),session=new Storage();const scripts:any[]=[];const cookies:string[]=[];let storageListener:(e:any)=>void;const win:any={location:{pathname:'/',hostname:'czystypomnik.waw.pl'},dispatchEvent:()=>true,addEventListener:(name:string,fn:any)=>{if(name==='storage')storageListener=fn;}};
Object.assign(globalThis,{window:win,localStorage:local,sessionStorage:session,document:{getElementById:()=>scripts[0],createElement:()=>({}),head:{appendChild:(s:any)=>scripts.push(s)},set cookie(value:string){cookies.push(value);}}});
test('brak zgody i odmowa nie pobierają Meta; zgoda wysyła tylko jeden Lead dla zapisanego zgłoszenia',()=>{
 configureMarketing('123456789012345');assert.equal(marketingConsent(),null);trackSavedLead('request-0000000001');assert.equal(scripts.length,0);assert.equal(win.fbq,undefined);
 saveMarketingConsent(false);trackSavedLead('request-0000000001');assert.equal(scripts.length,0);
 saveMarketingConsent(true);assert.equal(scripts.length,1);assert.equal(scripts[0].src,'https://connect.facebook.net/en_US/fbevents.js');
 const calls:any[][]=[];win.fbq.callMethod=(...args:any[])=>calls.push(args);win.fbq.queue=[];
 trackSavedLead('request-0000000002');trackSavedLead('request-0000000002');const leads=calls.filter(c=>c[0]==='trackSingle');assert.equal(leads.length,1);assert.deepEqual(leads[0],['trackSingle','123456789012345','Lead',{}, {eventID:'cp-lead-request-0000000002'}]);
 saveMarketingConsent(false);trackSavedLead('request-0000000003');assert.equal(calls.filter(c=>c[0]==='trackSingle').length,1);assert.ok(calls.some(c=>c[0]==='consent'&&c[1]==='revoke'));assert.ok(cookies.some(c=>c.startsWith('_fbp=;')));
});
test('nie odtwarza zdarzeń sprzed zgody, nie mierzy paneli i nie wysyła bez poprawnego identyfikatora',()=>{
 const calls:any[][]=[];win.fbq.callMethod=(...args:any[])=>calls.push(args);saveMarketingConsent(true);assert.equal(calls.filter(c=>c[0]==='trackSingle').length,0);
 for(const path of ['/admin','/ekipa','/dokumenty/prywatnosc']){win.location.pathname=path;configureMarketing('123456789012345');trackSavedLead('request-0000000004');}
 assert.equal(calls.filter(c=>c[0]==='trackSingle').length,0);win.location.pathname='/';configureMarketing('invalid-pixel-id');saveMarketingConsent(true);trackSavedLead('request-0000000005');assert.equal(calls.filter(c=>c[0]==='trackSingle').length,0);
});
test('wycofanie zgody usuwa zdarzenia oczekujące na pobranie SDK',()=>{
 win.fbq.callMethod=undefined;win.fbq.queue=[];configureMarketing('555555555555555');saveMarketingConsent(true);trackSavedLead('request-0000000006');assert.ok(win.fbq.queue.some((c:any[])=>c[0]==='trackSingle'));saveMarketingConsent(false);assert.ok(!win.fbq.queue.some((c:any[])=>c[0]==='trackSingle'));
});
test('wycofanie zgody w innej karcie blokuje pomiar w już otwartej karcie',()=>{
 saveMarketingConsent(true);const calls:any[][]=[];win.fbq.callMethod=(...args:any[])=>calls.push(args);local.setItem('cp_marketing_consent_v1',JSON.stringify({version:1,pixelId:'555555555555555',marketing:false,at:Date.now()}));storageListener({key:'cp_marketing_consent_v1'});trackSavedLead('request-0000000007');assert.equal(calls.filter(c=>c[0]==='trackSingle').length,0);assert.ok(calls.some(c=>c[0]==='consent'&&c[1]==='revoke'));
});
