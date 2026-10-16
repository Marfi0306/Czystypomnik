// Weryfikacja nie wypisuje wartości sekretów i nie uruchamia sprzedaży.
const required=['APP_ORIGIN','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','RESEND_API_KEY','MAIL_FROM','MAIL_REPLY_TO','ADMIN_EMAILS','COOKIE_SECRET','UPLOAD_SECRET','IP_HASH_SECRET','CRON_SECRET'];
const missing=required.filter(k=>!process.env[k]);
for(const k of ['BUSINESS_ROLES_CONFIRMED','OPERATIONS_CONFIRMED','DOCUMENTS_APPROVED'])if(process.env[k]!=='true')missing.push(k+'=true');
if(process.env.SUPABASE_REGION!=='eu-central-1')missing.push('SUPABASE_REGION=eu-central-1');
if(process.env.APP_MODE!=='production')missing.push('APP_MODE=production');
for(const k of ['APP_ORIGIN','SUPABASE_URL'])if(process.env[k]){try{const u=new URL(process.env[k]);if(u.protocol!=='https:')missing.push(k+' wymaga HTTPS');}catch{missing.push(k+' ma nieprawidłowy URL');}}
for(const k of ['COOKIE_SECRET','UPLOAD_SECRET','IP_HASH_SECRET','CRON_SECRET'])if(process.env[k]&&process.env[k].length<32)missing.push(k+' wymaga co najmniej 32 znaków');
if(missing.length){console.error('Braki konfiguracji produkcyjnej:\n'+missing.map(k=>'• '+k).join('\n'));process.exitCode=1;}
else console.log('Konfiguracja lokalna kompletna. Przed aktywacją wymagane są testy rzeczywistej bazy, poczty, retencji i settings.ready. Ten wynik nie potwierdza zewnętrznych usług.');
