import {useEffect} from 'react';
import type {Config} from '../shared/domain';
export const documentTitles:Record<string,string>={regulamin:'Regulamin zgłoszeń i usług',prywatnosc:'Polityka prywatności',odstapienie:'Prawo odstąpienia',cookies:'Informacja o cookies'};
export function visibleDocument(config:Config,key:string,hostname=location.hostname){
 let text=config.documents[key]||'';
 if(config.mode==='demo'&&(key==='prywatnosc'||key==='cookies')){
  const hosting=hostname.endsWith('.chatgpt.site')?'Podgląd jest udostępniany przez OpenAI Sites na chatgpt.site. Dostęp do niego może wymagać konta ChatGPT. Dostawca obsługuje dane techniczne połączenia i własne mechanizmy dostępu zgodnie ze swoimi warunkami: https://openai.com/policies/privacy-policy/.':hostname.endsWith('.vercel.app')?'Podgląd jest hostowany przez Vercel. Dostawca obsługuje techniczne informacje o połączeniu zgodnie ze swoimi warunkami: https://vercel.com/legal/privacy-policy.':'To podgląd aplikacji; dostawca użytego hostingu może przetwarzać techniczne informacje o połączeniu.';
  text='Informacja o tej wersji strony\n\nFormularz demonstracyjny nie wysyła danych ani zdjęć. Nie jest połączony z produkcyjną bazą Supabase ani automatyczną pocztą. '+hosting+'\n\nDalsza część przedstawia przygotowane zasady dla planowanej obsługi usług. Opis dostawców i okresów retencji nie potwierdza uruchomienia tych usług w podglądzie.\n\n'+text;
 }
 return text;
}
function Paragraph({text}:{text:string}){return <>{text.split(/(https?:\/\/[^\s)]+)/).map((s,i)=>/^https?:\/\//.test(s)?<a key={i} href={s.replace(/[.,;]+$/,'')} target="_blank" rel="noreferrer">{s}</a>:s)}</>;}
export default function Legal({config,doc}:{config:Config;doc:string}){
 const text=visibleDocument(config,doc);const title=documentTitles[doc];
 useEffect(()=>{document.title=(title||'Dokument')+' — Czysty Pomnik';const canonical=document.querySelector<HTMLLinkElement>('link[rel=canonical]');if(canonical)canonical.href=location.origin+location.pathname;},[title]);
 return <section className="container legal"><p className="eyebrow">CZYSTY POMNIK · DOKUMENTY</p><h1>{title||'Nie znaleziono dokumentu'}</h1>
 <nav className="legal-nav" aria-label="Dokumenty">{Object.entries(documentTitles).map(([key,name])=><a key={key} href={'/dokumenty/'+key} aria-current={doc===key?'page':undefined}>{name}</a>)}</nav>
 {!config.documentsApproved&&<p className="demo-note"><strong>Projekt do zatwierdzenia.</strong> Model zakłada SO SOCIAL jako usługodawcę i administratora danych. Role spółki wymagają potwierdzenia przed uruchomieniem zgłoszeń. Podgląd nie zawiera umów.</p>}
 {title?<><div className="legal-actions"><a className="button secondary" download={`Czysty-Pomnik-${doc}-${config.documentsVersion}.txt`} href={'data:text/plain;charset=utf-8,'+encodeURIComponent((!config.documentsApproved?'PROJEKT DO ZATWIERDZENIA\n\n':'')+text)}>Pobierz dokument TXT ↓</a><button className="button secondary" onClick={()=>window.print()}>Drukuj / zapisz PDF</button></div><article className="legal-body">{text.split(/\n\s*\n/).map((p,i)=>/^\d+\. [^\n]+$/.test(p)||(/^[^\n]{3,75}$/.test(p)&&!/[.:;]$/.test(p)&&i>1)?<h2 key={i}>{p}</h2>:<p key={i}><Paragraph text={p}/></p>)}</article></>:<p>Wybierz dokument z listy powyżej.</p>}
 <a className="text-link" href="/">← Wróć do strony</a></section>;
}
