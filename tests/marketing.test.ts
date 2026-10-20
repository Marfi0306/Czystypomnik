import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configureMarketing,marketingConsent,saveMarketingConsent,trackSavedLead,trackMarketingAction,marketingRequestHeaders} from '../src/marketing';
class Storage{data=new Map<string,string>();getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,v);}removeItem(k:string){this.data.delete(k);}}
const local=new Storage(),session=new Storage();const scripts:any[]=[];const cookies:string[]=[];let storageListener:(e:any)=>void;const win:any={location:{pathname:'/',hostname:'czystypomnik.waw.pl'},dispatchEvent:()=>true,addEventListener:(name:string,fn:any)=>{if(name==='storage')storageListener=fn;}};
Object.assign(globalThis,{window:win,localStorage:local,sessionStorage:session,document:{getElementById:()=>scripts[0],createElement:()=>({}),head:{appendChild:(s:any)=>scripts.push(s)},set cookie(value:string){cookies.push(value);}}});
test('stara zgoda i odmowa nie pobierają Meta; nowa zgoda wysyła jeden PageView i jeden Lead po zapisie',()=>{
 local.setItem('cp_marketing_consent_v1',JSON.stringify({version:1,pixelId:'123456789012345',marketing:true,at:Date.now()}));
 configureMarketing('123456789012345');assert.equal(marketingConsent(),null);trackSavedLead('request-0000000001');assert.equal(scripts.length,0);assert.equal(win.fbq,undefined);
 saveMarketingConsent(false);trackSavedLead('request-0000000001');assert.equal(scripts.length,0);
 saveMarketingConsent(true);assert.equal(scripts.length,1);assert.equal(scripts[0].src,'https://connect.facebook.net/en_US/fbevents.js');
 configureMarketing('123456789012345');saveMarketingConsent(true);assert.equal(win.fbq.queue.filter((c:any[])=>c[0]==='trackSingle'&&c[2]==='PageView').length,1);
 const calls:any[][]=[];win.fbq.callMethod=(...args:any[])=>calls.push(args);win.fbq.queue=[];
 trackSavedLead('request-0000000002');trackSavedLead('request-0000000002');const leads=calls.filter(c=>c[0]==='trackSingle'&&c[2]==='Lead');assert.equal(leads.length,1);assert.deepEqual(leads[0],['trackSingle','123456789012345','Lead',{}, {eventID:'cp-lead-request-0000000002'}]);
 saveMarketingConsent(false);trackSavedLead('request-0000000003');assert.equal(calls.filter(c=>c[0]==='trackSingle'&&c[2]==='Lead').length,1);assert.ok(calls.some(c=>c[0]==='consent'&&c[1]==='revoke'));assert.ok(cookies.some(c=>c.startsWith('_fbp=;')));
});
test('nie odtwarza zdarzeń sprzed zgody, nie mierzy paneli i nie wysyła bez poprawnego identyfikatora',()=>{
 const calls:any[][]=[];win.fbq.callMethod=(...args:any[])=>calls.push(args);saveMarketingConsent(true);assert.equal(calls.filter(c=>c[0]==='trackSingle'&&c[2]==='Lead').length,0);
 for(const path of ['/admin','/ekipa','/dokumenty/prywatnosc']){win.location.pathname=path;configureMarketing('123456789012345');trackSavedLead('request-0000000004');}
 assert.equal(calls.filter(c=>c[0]==='trackSingle'&&c[2]==='Lead').length,0);win.location.pathname='/';configureMarketing('invalid-pixel-id');saveMarketingConsent(true);trackSavedLead('request-0000000005');assert.equal(calls.filter(c=>c[0]==='trackSingle'&&c[2]==='Lead').length,0);
});
test('wycofanie zgody usuwa zdarzenia oczekujące na pobranie SDK',()=>{
 win.fbq.callMethod=undefined;win.fbq.queue=[];configureMarketing('555555555555555');saveMarketingConsent(true);trackSavedLead('request-0000000006');assert.ok(win.fbq.queue.some((c:any[])=>c[0]==='trackSingle'&&c[2]==='PageView'));assert.ok(win.fbq.queue.some((c:any[])=>c[0]==='trackSingle'&&c[2]==='Lead'));saveMarketingConsent(false);assert.ok(!win.fbq.queue.some((c:any[])=>c[0]==='trackSingle'));
});
test('wycofanie zgody w innej karcie blokuje pomiar w już otwartej karcie',()=>{
 saveMarketingConsent(true);const calls:any[][]=[];win.fbq.callMethod=(...args:any[])=>calls.push(args);local.setItem('cp_marketing_consent_v2',JSON.stringify({version:2,pixelId:'555555555555555',marketing:false,at:Date.now()}));storageListener({key:'cp_marketing_consent_v2'});trackSavedLead('request-0000000007');assert.equal(calls.filter(c=>c[0]==='trackSingle'&&c[2]==='Lead').length,0);assert.ok(calls.some(c=>c[0]==='consent'&&c[1]==='revoke'));
});

test('ponowna zgoda po wyczyszczeniu kolejki SDK przywraca PageView i nie duplikuje go',()=>{
 win.location.pathname='/';win.fbq.callMethod=undefined;win.fbq.queue=[];configureMarketing('666666666666666');saveMarketingConsent(true);
 const pageViews=()=>win.fbq.queue.filter((c:any[])=>c[0]==='trackSingle'&&c[2]==='PageView');assert.equal(pageViews().length,1);saveMarketingConsent(false);assert.equal(pageViews().length,0);
 saveMarketingConsent(true);configureMarketing('666666666666666');assert.equal(pageViews().length,1);
});

test('pełny lejek przekazuje wyłącznie dozwolone parametry; panele i odmowa nie wysyłają zdarzeń',()=>{
 const calls:any[][]=[];win.fbq.callMethod=(...args:any[])=>calls.push(args);saveMarketingConsent(true);
 assert.deepEqual(marketingRequestHeaders(),{'x-marketing-consent':'v2'});
 const actions=['package_viewed','package_selected','cemetery_searched','form_started','form_step','form_submitted','form_failed','contact_clicked'] as const;
 for(const action of actions)trackMarketingAction(action,{packageId:'silver',step:2,method:'phone',submissionId:'request-0000000008',email:'must-not-leak@example.invalid',location:'private-location'} as any);
 const events=calls.filter(c=>['trackSingle','trackSingleCustom'].includes(c[0]));assert.deepEqual(events.map(c=>c[2]),['ViewContent','PackageSelected','Search','FormStart','FormStep','FormSubmit','FormError','Contact']);
 assert.ok(!JSON.stringify(events).includes('must-not-leak'));assert.ok(!JSON.stringify(events).includes('private-location'));assert.ok(events.every(c=>typeof c[4].eventID==='string'));
 trackMarketingAction('package_viewed',{packageId:'silver'});trackMarketingAction('package_viewed',{packageId:'unknown'});assert.equal(calls.filter(c=>c[2]==='ViewContent').length,1);
 saveMarketingConsent(false);assert.deepEqual(marketingRequestHeaders(),{});const count=calls.length;for(const action of actions)trackMarketingAction(action,{packageId:'gold',step:3,method:'email'});assert.equal(calls.length,count);
 for(const path of ['/admin','/ekipa','/dokumenty/prywatnosc']){win.location.pathname=path;assert.deepEqual(marketingRequestHeaders(),{});trackMarketingAction('contact_clicked',{method:'phone'});}assert.equal(calls.length,count);win.location.pathname='/';
});
