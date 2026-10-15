-- Wszystkie zapisy przechodzą przez serwer; anon/authenticated nie mają dostępu do danych.
create table public.settings (id boolean primary key default true check(id), business jsonb not null default '{}', documents jsonb not null default '{}', documents_version text not null default 'draft', ready boolean not null default false);
insert into public.settings(id) values(true);
create table public.packages (id text primary key, name text not null, price integer not null check(price > 0), deposit integer not null check(deposit > 0 and deposit <= price), weight integer not null default 1 check(weight > 0), description text not null, features jsonb not null, version integer not null default 1, active boolean not null default true);
insert into public.packages(id,name,price,deposit,description,features) values
('silver','Silver',19900,5000,'Czysty nagrobek. Uporządkowane otoczenie.','["Ręczne mycie pojedynczego nagrobka", "Zebranie liści i drobnych chwastów", "Usunięcie wskazanych zniczy i kwiatów", "Zdjęcia przed i po wykonaniu"]'),
('gold','Gold',29900,7500,'Pielęgnacja z kwiatami i światłem pamięci.','["Wszystko, co zawiera pakiet Silver", "Chryzantema w doniczce 19 cm", "Dwa nowe szklane znicze", "Ustawienie i zapalenie zniczy"]'),
('platinum','Platinum',44900,15000,'Pełna troska o miejsce pamięci.','["Mycie i porządkowanie jak w Silver", "Dwie chryzantemy", "Stroik sztuczny", "Trzy nowe szklane znicze"]');
create table public.cemeteries (id uuid primary key default gen_random_uuid(), name text not null, address text not null, active boolean not null default true);
-- NULL = brak limitu zgodnie z decyzją właściciela. Brak rekordu = dzień zamknięty.
create table public.team_days (date date primary key, capacity integer check(capacity >= 0), closed boolean not null default false);
create table public.cemetery_days (cemetery_id uuid references public.cemeteries(id), date date references public.team_days(date), capacity integer check(capacity >= 0), closed boolean not null default false, primary key(cemetery_id,date));
create table public.orders (
 id uuid primary key default gen_random_uuid(), number bigint generated always as identity unique,
 idempotency_key uuid unique not null, payload_hash text not null, source text not null check(source in ('web','phone','meta')),
 cemetery_id uuid not null references public.cemeteries(id), date date not null,
 package_snapshot jsonb not null, cemetery_snapshot jsonb not null, documents_snapshot jsonb not null,
 customer jsonb not null, grave_details jsonb not null, notes text not null default '',
 status text not null default 'pending' check(status in ('pending','accepted','scheduled','in_progress','completed','rejected','cancelled','expired')),
 weight integer not null check(weight>0), deposit_received integer not null default 0 check(deposit_received >= 0), deposit_refunded integer not null default 0 check(deposit_refunded >= 0),
 payment_status text not null default 'due' check(payment_status in ('due','received','refunded')),
 terms_accepted boolean not null, early_start boolean not null, accepted_at timestamptz not null default now(),
 internal_note text not null default '', attention text not null default '', followup_at timestamptz,
 upload_secret_hash text not null, upload_expires_at timestamptz not null default now()+interval '1 hour', created_at timestamptz not null default now()
);
create index orders_calendar on public.orders(date,cemetery_id,status);
create table public.attachments (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), path text not null unique, type text not null check(type in ('image/jpeg','image/png','image/webp')), size integer not null check(size between 1 and 5242880), created_at timestamptz not null default now());
create table public.history (id bigint generated always as identity primary key, order_id uuid references public.orders(id), actor text not null, event text not null, details jsonb not null default '{}', created_at timestamptz not null default now());
create table public.outbox (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), kind text not null, recipient text not null, payload jsonb not null, state text not null default 'pending' check(state in ('pending','sending','sent','failed')), attempts integer not null default 0, next_attempt_at timestamptz not null default now(), locked_at timestamptz, provider_id text, last_error text, created_at timestamptz not null default now());
create index outbox_due on public.outbox(state,next_attempt_at);
create table public.rate_limits (key text primary key, count integer not null, expires_at timestamptz not null);

create function public.capacity_left(p_cemetery uuid,p_date date,p_weight integer) returns integer language plpgsql set search_path=public as $$
declare t team_days; c cemetery_days; tu integer; cu integer;
begin
 select * into t from team_days where date=p_date;
 if not found or t.closed then return 0; end if;
 select * into c from cemetery_days where cemetery_id=p_cemetery and date=p_date;
 if not found or c.closed then return 0; end if;
 select coalesce(sum(weight),0) into tu from orders where date=p_date and status in ('pending','accepted','scheduled','in_progress','completed');
 select coalesce(sum(weight),0) into cu from orders where date=p_date and cemetery_id=p_cemetery and status in ('pending','accepted','scheduled','in_progress','completed');
 if t.capacity is null and c.capacity is null then return null; end if;
 return greatest(0,least(coalesce((t.capacity-tu)/p_weight,2147483647),coalesce((c.capacity-cu)/p_weight,2147483647)));
end $$;

create function public.availability(p_cemetery uuid,p_package text) returns jsonb language sql set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('date',d.date,'remaining',public.capacity_left(p_cemetery,d.date,p.weight),'closed',d.closed or c.closed) order by d.date),'[]'::jsonb)
 from team_days d join cemetery_days c on c.date=d.date and c.cemetery_id=p_cemetery
 join cemeteries ce on ce.id=c.cemetery_id and ce.active
 join packages p on p.id=p_package and p.active
 where d.date >= (now() at time zone 'Europe/Warsaw')::date;
$$;

create function public.queue_notice(p_id uuid,p_kind text,p_message text default '') returns void language plpgsql set search_path=public as $$
declare o orders; s settings; snap jsonb;
begin
 select * into o from orders where id=p_id; select * into s from settings where id;
 snap := jsonb_build_object('number',o.number,'date',o.date,'cemetery',o.cemetery_snapshot,'package',o.package_snapshot,'customer',o.customer,'grave',o.grave_details,'documents',o.documents_snapshot,'earlyStart',o.early_start,'acceptedAt',o.accepted_at,'message',p_message,'status',o.status,'payment',o.payment_status,'depositReceived',o.deposit_received,'depositRefunded',o.deposit_refunded);
 insert into outbox(order_id,kind,recipient,payload) values(o.id,p_kind,o.customer->>'email',snap);
 if p_kind='received' then
  insert into outbox(order_id,kind,recipient,payload) values(o.id,'owner',s.business->>'email',snap);
 end if;
end $$;

create function public.reserve_order(p_input jsonb,p_hash text,p_upload_hash text,p_source text default 'web',p_actor text default 'customer') returns jsonb language plpgsql set search_path=public as $$
declare o orders; p packages; c cemeteries; s settings; left_count integer; day date;
begin
 -- Jedna blokada transakcyjna dla wszystkich operacji pojemności i konfiguracji.
 -- Mały zespół: prostsza poprawność niż wielokrotne blokady o różnej kolejności.
 perform pg_advisory_xact_lock(7210306);
 select * into o from orders where idempotency_key=(p_input->>'idempotencyKey')::uuid;
 if found then
  if o.payload_hash<>p_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return jsonb_build_object('id',o.id,'number',o.number,'status',o.status);
 end if;
 select * into s from settings where id;
 if not s.ready then raise exception 'NOT_READY'; end if;
 if p_input->>'documentsVersion' <> s.documents_version then raise exception 'DOCUMENTS_CHANGED'; end if;
 select * into p from packages where id=p_input->>'packageId' and active;
 if not found then raise exception 'PACKAGE_UNAVAILABLE'; end if;
 if p_input ? 'expectedPackageVersion' and (p_input->>'expectedPackageVersion')::integer<>p.version then raise exception 'PACKAGE_CHANGED'; end if;
 if coalesce((p_input->>'quotedPrice')::integer,-1)<>p.price or coalesce((p_input->>'quotedDeposit')::integer,-1)<>p.deposit then raise exception 'PACKAGE_CHANGED'; end if;
 select * into c from cemeteries where id=(p_input->>'cemeteryId')::uuid and active;
 if not found then raise exception 'CEMETERY_UNAVAILABLE'; end if;
 day := (p_input->>'date')::date;
 if day < (now() at time zone 'Europe/Warsaw')::date then raise exception 'PAST_DATE'; end if;
 if p_input->>'variant'<>'single-granite' or not coalesce((p_input->>'terms')::boolean,false) then raise exception 'INVALID_ORDER'; end if;
 if day < (now() at time zone 'Europe/Warsaw')::date+14 and not coalesce((p_input->>'earlyStart')::boolean,false) then raise exception 'EARLY_START_REQUIRED'; end if;
 left_count := public.capacity_left(c.id,day,p.weight);
 if left_count is not null and left_count<1 then raise exception 'FULL'; end if;
 insert into orders(idempotency_key,payload_hash,upload_secret_hash,source,cemetery_id,date,weight,package_snapshot,cemetery_snapshot,documents_snapshot,customer,grave_details,notes,terms_accepted,early_start)
 values((p_input->>'idempotencyKey')::uuid,p_hash,p_upload_hash,p_source,c.id,day,p.weight,to_jsonb(p),to_jsonb(c),jsonb_build_object('version',s.documents_version,'texts',s.documents,'business',s.business,'declarations',p_input->'declarations'),
 jsonb_build_object('name',p_input->>'name','phone',p_input->>'phone','email',p_input->>'email'),
 jsonb_build_object('location',p_input->>'location','inscription',p_input->>'inscription','sector',p_input->>'sector','row',p_input->>'row','grave',p_input->>'grave','variant',p_input->>'variant'),coalesce(p_input->>'notes',''),true,(p_input->>'earlyStart')::boolean) returning * into o;
 insert into history(order_id,actor,event) values(o.id,p_actor,'created');
 perform public.queue_notice(o.id,'received');
 return jsonb_build_object('id',o.id,'number',o.number,'status',o.status);
end $$;

create function public.admin_change(p_id uuid,p_action text,p_data jsonb,p_actor text) returns void language plpgsql set search_path=public as $$
declare o orders; target_date date; target_cemetery uuid; l integer; st text; public_message text;
begin
 perform pg_advisory_xact_lock(7210306);
 select * into o from orders where id=p_id for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 public_message := coalesce(p_data->>'message','');
 if p_action='status' then
  st := p_data->>'status';
  if st=o.status then return; end if;
  if o.status in ('completed','cancelled','rejected','expired') then raise exception 'TERMINAL_STATUS'; end if;
  if st not in ('accepted','scheduled','in_progress','completed','rejected','cancelled','expired') then raise exception 'INVALID_STATUS'; end if;
  if (o.status='pending' and st not in ('accepted','rejected','cancelled','expired')) or (o.status='accepted' and st not in ('scheduled','in_progress','cancelled')) or (o.status='scheduled' and st not in ('in_progress','cancelled')) or (o.status='in_progress' and st not in ('completed','cancelled')) then raise exception 'INVALID_TRANSITION'; end if;
  if st in ('rejected','cancelled','expired') and length(public_message)<3 then raise exception 'REASON_REQUIRED'; end if;
  update orders set status=st where id=p_id;
  perform queue_notice(p_id,case when st='accepted' then 'accepted' else 'changed' end,public_message);
 elsif p_action='move' then
  if o.status in ('completed','cancelled','rejected','expired') then raise exception 'TERMINAL_STATUS'; end if;
  target_date := (p_data->>'date')::date; target_cemetery := (p_data->>'cemeteryId')::uuid;
  if target_date=o.date and target_cemetery=o.cemetery_id then return; end if;
  if target_date<(now() at time zone 'Europe/Warsaw')::date then raise exception 'PAST_DATE'; end if;
  if not exists(select 1 from cemeteries where id=target_cemetery and active) then raise exception 'CEMETERY_UNAVAILABLE'; end if;
  if target_date<(now() at time zone 'Europe/Warsaw')::date+14 and not o.early_start then raise exception 'EARLY_START_REQUIRED'; end if;
  -- Tymczasowe wyłączenie starego zajęcia w tej samej transakcji.
  update orders set status='cancelled' where id=p_id;
  l := capacity_left(target_cemetery,target_date,o.weight);
  if l is not null and l<1 then raise exception 'FULL'; end if;
  update orders set date=target_date,cemetery_id=target_cemetery,cemetery_snapshot=(select to_jsonb(c) from cemeteries c where id=target_cemetery),status=o.status where id=p_id;
  perform queue_notice(p_id,'changed',public_message);
 elsif p_action='deposit' then
  if o.status in ('pending','rejected','cancelled','expired') then raise exception 'NOT_ACCEPTED'; end if;
  if o.payment_status='received' then return; end if;
  if o.payment_status='refunded' then raise exception 'ALREADY_REFUNDED'; end if;
  update orders set payment_status='received',deposit_received=(package_snapshot->>'deposit')::integer where id=p_id;
  perform queue_notice(p_id,'deposit');
 elsif p_action='refund' then
  if o.payment_status='refunded' then return; end if;
  if o.payment_status<>'received' then raise exception 'NO_DEPOSIT'; end if;
  update orders set payment_status='refunded',deposit_refunded=deposit_received where id=p_id;
  perform queue_notice(p_id,'changed',public_message);
 elsif p_action='note' then
  update orders set internal_note=coalesce(p_data->>'note',''),attention=coalesce(p_data->>'attention',''),followup_at=nullif(p_data->>'followupAt','')::timestamptz where id=p_id;
 else raise exception 'UNKNOWN_ACTION'; end if;
 insert into history(order_id,actor,event,details) values(p_id,p_actor,p_action,jsonb_build_object('beforeStatus',o.status,'beforeDate',o.date,'after',p_data));
end $$;

create function public.configure_day(p_date date,p_cemetery uuid,p_capacity integer,p_closed boolean,p_actor text) returns void language plpgsql set search_path=public as $$
declare used integer;
begin
 perform pg_advisory_xact_lock(7210306);
 if p_date<(now() at time zone 'Europe/Warsaw')::date then raise exception 'PAST_DATE'; end if;
 select coalesce(sum(weight),0) into used from orders where date=p_date and (p_cemetery is null or cemetery_id=p_cemetery) and status in ('pending','accepted','scheduled','in_progress','completed');
 if p_capacity is not null and p_capacity<used then raise exception 'CAPACITY_BELOW_OCCUPANCY'; end if;
 if p_cemetery is null then insert into team_days(date,capacity,closed) values(p_date,p_capacity,p_closed) on conflict(date) do update set capacity=excluded.capacity,closed=excluded.closed;
 else insert into cemetery_days(cemetery_id,date,capacity,closed) values(p_cemetery,p_date,p_capacity,p_closed) on conflict(cemetery_id,date) do update set capacity=excluded.capacity,closed=excluded.closed; end if;
 insert into history(actor,event,details) values(p_actor,'capacity',jsonb_build_object('date',p_date,'cemetery',p_cemetery,'capacity',p_capacity,'closed',p_closed));
end $$;

create function public.configure_package(p_id text,p_price integer,p_deposit integer,p_weight integer,p_active boolean,p_actor text) returns void language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(7210306);
 update packages set price=p_price,deposit=p_deposit,weight=p_weight,active=p_active,version=version+1 where id=p_id;
 if not found then raise exception 'PACKAGE_UNAVAILABLE'; end if;
 insert into history(actor,event,details) values(p_actor,'package',jsonb_build_object('id',p_id,'price',p_price,'deposit',p_deposit,'weight',p_weight,'active',p_active));
end $$;

create function public.claim_outbox() returns setof public.outbox language plpgsql set search_path=public as $$
begin
 return query update outbox set state='sending',locked_at=now(),attempts=attempts+1 where id in
 (select id from outbox where ((state in ('pending','failed') and next_attempt_at<=now()) or (state='sending' and locked_at<now()-interval '5 minutes')) and attempts<8 order by created_at for update skip locked limit 10) returning *;
end $$;
create function public.take_rate(p_key text) returns boolean language plpgsql set search_path=public as $$
declare n integer;
begin
 insert into rate_limits(key,count,expires_at) values(p_key,1,now()+interval '15 minutes') on conflict(key) do update set count=case when rate_limits.expires_at<now() then 1 else rate_limits.count+1 end,expires_at=case when rate_limits.expires_at<now() then now()+interval '15 minutes' else rate_limits.expires_at end returning count into n;
 delete from rate_limits where expires_at<now()-interval '1 day';
 return n<=10;
end $$;

-- Wszystkie funkcje prywatne; service_role używa ich przez sprawdzony backend.
do $$ declare t text; begin
 foreach t in array array['settings','packages','cemeteries','team_days','cemetery_days','orders','attachments','history','outbox','rate_limits'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on all functions in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
