-- Worker credentials and opaque sessions are server-only. Never grant client roles access.
create table public.workers (
 id uuid primary key default gen_random_uuid(), login text unique not null check(login ~ '^[a-z0-9_-]{2,40}$'), name text not null,
 email text, active boolean not null default true, password_hash text not null check(length(password_hash)=128), password_salt text not null,
 must_change_password boolean not null default true, created_at timestamptz not null default now()
);
create table public.worker_sessions(token_hash text primary key,worker_id uuid not null references public.workers(id),expires_at timestamptz not null);
create index worker_sessions_worker on public.worker_sessions(worker_id);
alter table public.workers enable row level security;
alter table public.worker_sessions enable row level security;
revoke all on public.workers,public.worker_sessions from public,anon,authenticated;
grant all on public.workers,public.worker_sessions to service_role;
alter table public.orders add column worker_id uuid references public.workers(id), add column assignment_version uuid,
 add column assignment_state text check(assignment_state in ('awaiting','accepted','declined','completed')),
 add column assigned_at timestamptz, add column work_completed_at timestamptz;
create index orders_worker_calendar on public.orders(worker_id,date) where worker_id is not null;
alter table public.attachments add column kind text not null default 'reference' check(kind in ('reference','completion')),
 add column worker_id uuid references public.workers(id), add column assignment_version uuid;

create function public.crew_password(p_worker uuid,p_old_hash text,p_hash text,p_salt text) returns void language plpgsql set search_path=public as $$
begin
 update workers set password_hash=p_hash,password_salt=p_salt,must_change_password=false where id=p_worker and active and password_hash=p_old_hash;
 if not found then raise exception 'UNAUTHORIZED';end if;
 delete from worker_sessions where worker_id=p_worker;
end $$;
create function public.crew_check(p_worker uuid,p_order uuid,p_version uuid) returns void language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from orders o join workers w on w.id=o.worker_id where o.id=p_order and w.id=p_worker and w.active and not w.must_change_password and o.assignment_version=p_version and not o.retention_locked and o.status not in ('cancelled','rejected','expired')) then raise exception 'NOT_FOUND';end if;
end $$;
-- Explicit projection: no customer contact, payment data, contracts or internal notes.
create function public.crew_orders(p_worker uuid) returns jsonb language sql set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'number',o.number,'date',o.date,'status',o.status,'worker_id',o.worker_id,'assignment_version',o.assignment_version,'assignment_state',o.assignment_state,'work_completed_at',o.work_completed_at,
 'cemetery_snapshot',o.cemetery_snapshot,'package_snapshot',jsonb_build_object('name',o.package_snapshot->>'name','features',o.package_snapshot->'features'),
 'grave_details',o.grave_details,'notes',o.notes,'scope',q.payload->>'scope','ready_for_work',o.contract_at is not null and o.status in ('accepted','scheduled','in_progress')) order by o.date,o.number),'[]'::jsonb)
 from orders o join workers w on w.id=o.worker_id left join offers q on q.id=o.offer_id
 where w.id=p_worker and w.active and not w.must_change_password and not o.retention_locked and o.status not in ('cancelled','rejected','expired');
$$;
create function public.assign_worker(p_order uuid,p_worker uuid,p_actor text) returns void language plpgsql set search_path=public as $$
declare o orders;
begin
 perform pg_advisory_xact_lock(7210306);select * into o from orders where id=p_order for update;
 if not found then raise exception 'NOT_FOUND';end if;if o.retention_locked then raise exception 'RETENTION_IN_PROGRESS';end if;
 if o.status in ('completed','cancelled','rejected','expired') or o.assignment_state='completed' then raise exception 'TERMINAL_STATUS';end if;
 if p_worker is not null and (o.date is null or not exists(select 1 from workers where id=p_worker and active)) then raise exception 'DATE_REQUIRED';end if;
 if o.worker_id is not distinct from p_worker and o.assignment_state is distinct from 'declined' then return;end if;
 update orders set worker_id=p_worker,assignment_version=case when p_worker is null then null else gen_random_uuid() end,assignment_state=case when p_worker is null then null else 'awaiting' end,assigned_at=now(),work_completed_at=null where id=p_order;
 insert into history(order_id,actor,event,details) values(p_order,p_actor,'worker_assigned',jsonb_build_object('workerId',p_worker));
end $$;
-- Rescheduling or changes to the work scope require the worker to confirm again.
create function public.refresh_work_assignment() returns trigger language plpgsql set search_path=public as $$
begin
 if new.worker_id is not null and new.worker_id is not distinct from old.worker_id and
 (new.date is distinct from old.date or new.cemetery_id is distinct from old.cemetery_id or new.grave_details is distinct from old.grave_details or new.package_snapshot is distinct from old.package_snapshot or new.notes is distinct from old.notes or new.offer_id is distinct from old.offer_id) then
  new.assignment_version=gen_random_uuid();new.assignment_state='awaiting';new.assigned_at=now();new.work_completed_at=null;
 end if;return new;
end $$;
create trigger refresh_work_assignment before update on public.orders for each row execute function public.refresh_work_assignment();
create function public.queue_worker_assignment() returns trigger language plpgsql set search_path=public as $$
declare w workers;
begin
 if new.assignment_version is distinct from old.assignment_version or new.status in ('cancelled','rejected','expired') then
  update outbox set state='cancelled',payload='{}',last_error='SUPERSEDED_ASSIGNMENT' where order_id=new.id and kind='worker_assignment' and state in ('pending','failed');
  if new.worker_id is not null and new.status not in ('cancelled','rejected','expired') then
   select * into w from workers where id=new.worker_id and active;
   if found and w.email is not null then insert into outbox(order_id,kind,recipient,payload) values(new.id,'worker_assignment',w.email,jsonb_build_object('workerId',w.id,'workerName',w.name,'assignmentVersion',new.assignment_version,'number',new.number,'date',new.date));end if;
  end if;
 end if;return new;
end $$;
create trigger queue_worker_assignment after update on public.orders for each row execute function public.queue_worker_assignment();
create function public.configure_worker(p_worker uuid,p_email text,p_active boolean,p_actor text) returns void language plpgsql set search_path=public as $$
declare old_email text;
begin
 perform pg_advisory_xact_lock(7210306);select email into old_email from workers where id=p_worker for update;
 if not found then raise exception 'NOT_FOUND';end if;
 update workers set email=nullif(p_email,''),active=p_active where id=p_worker;
 if not p_active then delete from worker_sessions where worker_id=p_worker;end if;
 if not p_active or old_email is distinct from nullif(p_email,'') then
  update outbox set state='cancelled',payload='{}',last_error='WORKER_CONTACT_CHANGED' where kind='worker_assignment' and payload->>'workerId'=p_worker::text and state in ('pending','failed');
 end if;
 if p_active and nullif(p_email,'') is not null and old_email is distinct from nullif(p_email,'') then
  update orders set assignment_version=gen_random_uuid() where worker_id=p_worker and assignment_state='awaiting' and status not in ('completed','cancelled','rejected','expired');
 end if;
 insert into history(actor,event,details) values(p_actor,'worker_updated',jsonb_build_object('workerId',p_worker,'active',p_active));
end $$;
create function public.crew_change(p_worker uuid,p_order uuid,p_version uuid,p_action text,p_reason text default '') returns void language plpgsql set search_path=public as $$
declare o orders;
begin
 perform pg_advisory_xact_lock(7210306);select * into o from orders where id=p_order for update;perform crew_check(p_worker,p_order,p_version);
 if p_action='accept' then
  if o.assignment_state='accepted' then return;end if;if o.assignment_state<>'awaiting' then raise exception 'INVALID_TRANSITION';end if;
  update orders set assignment_state='accepted' where id=p_order;
 elsif p_action='decline' then
  if o.assignment_state='declined' then return;end if;if o.assignment_state not in ('awaiting','accepted') then raise exception 'INVALID_TRANSITION';end if;
  update orders set assignment_state='declined' where id=p_order;
 elsif p_action='complete' then
  if o.assignment_state='completed' then return;end if;
  if o.assignment_state<>'accepted' then raise exception 'NOT_ACCEPTED';end if;
  if o.date is null or o.date>(now() at time zone 'Europe/Warsaw')::date then raise exception 'WORK_DAY_REQUIRED';end if;
  if o.contract_at is null or o.status not in ('accepted','scheduled','in_progress') then raise exception 'CONTRACT_REQUIRED';end if;
  if not exists(select 1 from attachments where order_id=p_order and worker_id=p_worker and assignment_version=p_version and kind='completion') then raise exception 'COMPLETION_PHOTO_REQUIRED';end if;
  update orders set assignment_state='completed',work_completed_at=now(),status='in_progress',attention='Prace zakończone — zdjęcia do przekazania i rozliczenie' where id=p_order;
 else raise exception 'INVALID_TRANSITION';end if;
 insert into history(order_id,actor,event,details) values(p_order,'worker:'||p_worker,'work_'||p_action,jsonb_build_object('reason',left(p_reason,1000),'version',p_version));
end $$;
create function public.crew_photo(p_worker uuid,p_order uuid,p_version uuid,p_path text,p_size integer) returns void language plpgsql set search_path=public as $$
declare o orders;
begin
 perform pg_advisory_xact_lock(7210306);select * into o from orders where id=p_order for update;perform crew_check(p_worker,p_order,p_version);
 if o.assignment_state<>'accepted' then raise exception 'NOT_ACCEPTED';end if;
 if o.date is null or o.date>(now() at time zone 'Europe/Warsaw')::date then raise exception 'WORK_DAY_REQUIRED';end if;
 if o.contract_at is null or o.status not in ('accepted','scheduled','in_progress') then raise exception 'CONTRACT_REQUIRED';end if;
 if p_path not like p_order::text||'/completion/'||p_version::text||'/%' or p_size not between 1 and 5242880 then raise exception 'INVALID_FILE';end if;
 if (select count(*) from attachments where order_id=p_order and assignment_version=p_version and kind='completion')>=10 then raise exception 'INVALID_FILE';end if;
 insert into attachments(order_id,path,type,size,kind,worker_id,assignment_version) values(p_order,p_path,'image/webp',p_size,'completion',p_worker,p_version);
 insert into history(order_id,actor,event) values(p_order,'worker:'||p_worker,'completion_photo');
end $$;
create function public.worker_mail_valid(p_id uuid) returns boolean language sql set search_path=public as $$
 select exists(select 1 from outbox m join orders o on o.id=m.order_id join workers w on w.id=o.worker_id
 where m.id=p_id and m.kind='worker_assignment' and w.active and w.email=m.recipient and o.assignment_version::text=m.payload->>'assignmentVersion' and not o.retention_locked and o.status not in ('cancelled','rejected','expired'));
$$;
create function public.claim_team_outbox() returns setof public.outbox language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(7210306);
 return query update outbox set state='sending',locked_at=now(),attempts=attempts+1 where id in
 (select m.id from outbox m where ((m.kind='owner' and m.recipient='czystypomnikwarszawa@gmail.com') or (m.kind='worker_assignment' and worker_mail_valid(m.id)))
 and ((m.state in ('pending','failed') and m.next_attempt_at<=now()) or (m.state='sending' and m.locked_at<now()-interval '5 minutes'))
 and m.attempts<8 and not exists(select 1 from orders o where o.id=m.order_id and o.retention_locked)
 order by m.created_at,m.id for update skip locked limit 5) returning *;
 delete from worker_sessions where expires_at<now();
end $$;
revoke all on function public.crew_password(uuid,text,text,text),public.crew_check(uuid,uuid,uuid),public.crew_orders(uuid),public.assign_worker(uuid,uuid,text),public.crew_change(uuid,uuid,uuid,text,text),public.crew_photo(uuid,uuid,uuid,text,integer),public.worker_mail_valid(uuid),public.claim_team_outbox(),public.refresh_work_assignment(),public.queue_worker_assignment() from public,anon,authenticated;
revoke all on function public.configure_worker(uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.configure_worker(uuid,text,boolean,text) to service_role;
grant execute on function public.crew_password(uuid,text,text,text),public.crew_check(uuid,uuid,uuid),public.crew_orders(uuid),public.assign_worker(uuid,uuid,text),public.crew_change(uuid,uuid,uuid,text,text),public.crew_photo(uuid,uuid,uuid,text,integer),public.worker_mail_valid(uuid),public.claim_team_outbox() to service_role;

-- Reuse the existing minute scheduler and its Vault secret; no new client-mail automation.
create schema if not exists notification_jobs;
revoke all on schema notification_jobs from public,anon,authenticated;
create or replace function notification_jobs.dispatch_owner_alerts() returns bigint language plpgsql set search_path='' as $dispatch$
declare token text; request_id bigint;
begin
 if not exists(select 1 from public.outbox m where ((m.kind='owner' and m.recipient='czystypomnikwarszawa@gmail.com') or (m.kind='worker_assignment' and public.worker_mail_valid(m.id))) and m.attempts<8 and ((m.state in ('pending','failed') and m.next_attempt_at<=now()) or (m.state='sending' and m.locked_at<now()-interval '5 minutes'))) then return null;end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='owner_notify_secret';
 if token is null then raise exception 'OWNER_NOTIFY_SECRET_MISSING';end if;
 select net.http_post(url:='https://czystypomnik.waw.pl/api/internal/owner-notifications',headers:=jsonb_build_object('Authorization','Bearer '||token,'Content-Type','application/json'),body:='{}'::jsonb,timeout_milliseconds:=55000) into request_id;return request_id;
end $dispatch$;
revoke all on function notification_jobs.dispatch_owner_alerts() from public,anon,authenticated;
