import {readFile,writeFile} from 'node:fs/promises';
const launch=process.env.PUBLIC_LAUNCH==='true';
const origin=process.env.SITE_PUBLIC_URL;
if(launch&&(!origin||!origin.startsWith('https://')||process.env.BUSINESS_ROLES_CONFIRMED!=='true'||process.env.DOCUMENTS_APPROVED!=='true'))throw new Error('Publiczne indeksowanie wymaga SITE_PUBLIC_URL z HTTPS oraz potwierdzenia ról i dokumentów.');
let html=await readFile('dist/index.html','utf8');
if(launch){
 const base=new URL(origin).origin;const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 html=html.replace('noindex, nofollow','index, follow').replace(' Podgląd strony, zamówienia nie są jeszcze przyjmowane.',' Zgłoś chęć realizacji i otrzymaj ofertę e-mailem.').replace('Zobacz podgląd strony.','Wybierz pakiet i preferowany dzień.');
 html=html.replace('</head>',`<link rel="canonical" href="${escape(base)}/"/><meta property="og:url" content="${escape(base)}/"/><meta property="og:image" content="${escape(base)}/images/after.webp"/></head>`);
 await writeFile('dist/robots.txt',`User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`);
 // Dokumenty mają treść w aplikacji; nie narzucamy im kanonicznej strony głównej.
 await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(base)}/</loc></url></urlset>`);
}
await writeFile('dist/index.html',html);
