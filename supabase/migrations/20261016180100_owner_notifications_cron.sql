create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create schema if not exists notification_jobs;
revoke all on schema notification_jobs from public,anon,authenticated;
create function notification_jobs.dispatch_owner_alerts() returns bigint language plpgsql set search_path='' as $$
declare token text; request_id bigint;
begin
 if not exists(select 1 from public.outbox where kind='owner' and recipient='czystypomnikwarszawa@gmail.com' and attempts<8 and ((state in ('pending','failed') and next_attempt_at<=now()) or (state='sending' and locked_at<now()-interval '5 minutes'))) then return null; end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='owner_notify_secret';
 if token is null then raise exception 'OWNER_NOTIFY_SECRET_MISSING'; end if;
 select net.http_post(url:='https://czystypomnik.waw.pl/api/internal/owner-notifications',headers:=jsonb_build_object('Authorization','Bearer '||token,'Content-Type','application/json'),body:='{}'::jsonb,timeout_milliseconds:=55000) into request_id;
 return request_id;
end $$;
revoke all on function notification_jobs.dispatch_owner_alerts() from public,anon,authenticated;
-- Activate only after the deployment is ready and the Vault secret is provisioned.
select cron.schedule('czysty-pomnik-owner-alerts','* * * * *','select notification_jobs.dispatch_owner_alerts()');
select cron.alter_job((select jobid from cron.job where jobname='czysty-pomnik-owner-alerts'),active:=false);
