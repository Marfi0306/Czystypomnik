import {useEffect,useState} from 'react';
import {marketingConsent} from './marketing';

// Explicit diagnostic view only; no form values, customer data or access tokens.
export default function MarketingDiagnostics(){
 const enabled=new URLSearchParams(location.search).get('meta_debug')==='1';
 const testCode=new URLSearchParams(location.search).get('meta_test');
 const [rows,setRows]=useState<{name:string;state:string;id?:string}[]>([]);
 const [consent,setConsent]=useState(false);
 useEffect(()=>{
  if(!enabled)return;
  const choice=()=>setConsent(marketingConsent()?.marketing===true);
  const delivery=(event:Event)=>{const {name,state,id}=(event as CustomEvent).detail;setRows(previous=>[...previous.filter(row=>row.id!==id),{name,state,id}].slice(-12));};
  choice();window.addEventListener('cp:marketing-consent',choice);window.addEventListener('cp:marketing-delivery',delivery);
  return()=>{window.removeEventListener('cp:marketing-consent',choice);window.removeEventListener('cp:marketing-delivery',delivery);};
 },[enabled]);
 if(!enabled)return null;
 const states:Record<string,string>={sent:'Meta potwierdziła odbiór (serwer)',failed:'Brak potwierdzenia — błąd wysyłki',disabled:'Kanał serwerowy nieaktywny',no_consent:'Brak aktualnej zgody'};
 return <aside aria-label="Diagnostyka Meta" style={{position:'fixed',top:105,right:12,zIndex:90,maxWidth:440,maxHeight:'60vh',overflow:'auto',padding:18,background:'#fff',color:'#10213a',border:'2px solid #b4975c',borderRadius:8,boxShadow:'0 8px 24px #0002',font:'14px/1.5 system-ui'}}><strong>Diagnostyka Meta · 1449807230414613</strong><p>Zgoda marketingowa: {consent?'udzielona':'brak'}</p>{testCode&&/^TEST\d{1,20}$/.test(testCode)&&<p>Kod testu czynności: {testCode}. Wysłanie zgłoszenia pozostaje zdarzeniem produkcyjnym.</p>}{rows.length?<ul style={{paddingLeft:20}}>{rows.map((row,index)=><li key={row.id||index}><strong>{row.name}</strong>: {states[row.state]||'Nieznany wynik'}<br/><small>{row.id}</small></li>)}</ul>:<p>Oczekiwanie na czynność po zgodzie.</p>}<small>To potwierdzenie odpowiedzi API Meta. Dostępność zdarzenia w jej panelu sprawdza się osobno.</small></aside>;
}
