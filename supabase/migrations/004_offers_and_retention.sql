-- Zgłoszenie nie zawiera umowy. Ofertę i e-mailową akceptację utrwalamy osobno.
alter table public.orders add column contract_at timestamptz,
 add column contract_evidence jsonb,
 add column offer_id uuid,
 add column completed_at timestamptz,
 add column delivery_evidence jsonb,
 add column last_contact_at timestamptz not null default now(),
 add column retention_hold boolean not null default false,
 add column retention_reason text not null default '',
 add column retention_locked boolean not null default false;
alter table public.outbox drop constraint outbox_state_check;
alter table public.outbox add constraint outbox_state_check check(state in ('pending','sending','sent','failed','cancelled'));
create table public.offers (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
 payload jsonb not null, valid_until timestamptz not null, created_at timestamptz not null default now()
);
alter table public.orders add constraint orders_offer foreign key(offer_id) references public.offers(id);
alter table public.offers enable row level security;
revoke all on public.offers from anon,authenticated;
grant all on public.offers to service_role;

create or replace function public.queue_notice(p_id uuid,p_kind text,p_message text default '') returns void language plpgsql set search_path=public as $$
declare o orders; s settings; q offers; snap jsonb;
begin
 select * into o from orders where id=p_id; select * into s from settings where id;
 select * into q from offers where id=o.offer_id;
 snap := jsonb_build_object('number',o.number,'date',o.date,'cemetery',o.cemetery_snapshot,'package',o.package_snapshot,'customer',o.customer,'grave',o.grave_details,'documents',o.documents_snapshot,'earlyStart',o.early_start,'receivedAt',o.accepted_at,'contractAt',o.contract_at,'deliveryEvidence',o.delivery_evidence,'offer',case when q.id is null then null else q.payload||jsonb_build_object('id',q.id,'createdAt',q.created_at) end,'message',p_message,'status',o.status,'payment',o.payment_status,'depositReceived',o.deposit_received,'depositRefunded',o.deposit_refunded);
 insert into outbox(order_id,kind,recipient,payload) values(o.id,p_kind,o.customer->>'email',snap);
 if p_kind='received' then insert into outbox(order_id,kind,recipient,payload) values(o.id,'owner',s.business->>'email',snap); end if;
end $$;

create or replace function public.reserve_order(p_input jsonb,p_hash text,p_upload_hash text,p_source text default 'web',p_actor text default 'customer') returns jsonb language plpgsql set search_path=public as $$
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
 if coalesce((p_input->>'earlyStart')::boolean,false) then raise exception 'INVALID_ORDER'; end if;
 left_count := public.capacity_left(c.id,day,p.weight);
 if left_count is not null and left_count<1 then raise exception 'FULL'; end if;
 insert into orders(idempotency_key,payload_hash,upload_secret_hash,source,cemetery_id,date,weight,package_snapshot,cemetery_snapshot,documents_snapshot,customer,grave_details,notes,terms_accepted,early_start)
 values((p_input->>'idempotencyKey')::uuid,p_hash,p_upload_hash,p_source,c.id,day,p.weight,to_jsonb(p),to_jsonb(c),jsonb_build_object('version',s.documents_version,'texts',s.documents,'business',s.business,'declarations',p_input->'declarations'),
 jsonb_build_object('name',p_input->>'name','phone',p_input->>'phone','email',p_input->>'email'),
 jsonb_build_object('location',p_input->>'location','inscription',p_input->>'inscription','sector',p_input->>'sector','row',p_input->>'row','grave',p_input->>'grave','variant',p_input->>'variant'),coalesce(p_input->>'notes',''),true,false) returning * into o;
 insert into history(order_id,actor,event) values(o.id,p_actor,'created');
 perform public.queue_notice(o.id,'received');
 return jsonb_build_object('id',o.id,'number',o.number,'status',o.status);
end $$;

create or replace function public.admin_change(p_id uuid,p_action text,p_data jsonb,p_actor text) returns void language plpgsql set search_path=public as $$
declare o orders; target_date date; target_cemetery uuid; l integer; st text; public_message text; q offers; s settings; received timestamptz; early_evidence text;
begin
 perform pg_advisory_xact_lock(7210306);
 select * into o from orders where id=p_id for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if o.retention_locked then raise exception 'RETENTION_IN_PROGRESS'; end if;
 public_message := coalesce(p_data->>'message','');
 if p_action='offer' then
  if o.status<>'pending' or o.contract_at is not null then raise exception 'INVALID_TRANSITION'; end if;
  if exists(select 1 from outbox where order_id=p_id and kind='offer' and state='sending') then raise exception 'OFFER_SENDING'; end if;
  if coalesce((p_data->>'price')::integer,0)<1 or coalesce((p_data->>'deposit')::integer,0)<1 or (p_data->>'deposit')::integer>(p_data->>'price')::integer or length(coalesce(p_data->>'scope',''))<20 or coalesce(p_data->>'bankAccount','') !~ '^(PL)?[0-9]{26}$' or
     (p_data->>'validUntil')::timestamptz<=now() or (p_data->>'depositDue')::timestamptz<(p_data->>'validUntil')::timestamptz then raise exception 'OFFER_INVALID'; end if;
  select * into s from settings where id;
  insert into offers(order_id,valid_until,payload) values(p_id,(p_data->>'validUntil')::timestamptz,
    p_data||jsonb_build_object('package',o.package_snapshot||jsonb_build_object('price',(p_data->>'price')::integer,'deposit',(p_data->>'deposit')::integer),'date',o.date,'cemetery',o.cemetery_snapshot,'grave',o.grave_details,
      'documents',jsonb_build_object('version',s.documents_version,'texts',s.documents,'business',s.business))) returning * into q;
  update orders set offer_id=q.id,last_contact_at=now() where id=p_id;
  -- Zastąpiona oferta oczekująca nie powinna trafić później do klienta.
  update outbox set state='cancelled',payload='{}',last_error='SUPERSEDED' where order_id=p_id and kind='offer' and state in ('pending','failed');
  perform queue_notice(p_id,'offer');
 elsif p_action='contract' then
  if o.contract_at is not null then
   if o.offer_id=(p_data->>'offerId')::uuid and o.contract_evidence->>'emailMessageId'=p_data->>'emailMessageId' then return; end if;
   raise exception 'INVALID_TRANSITION';
  end if;
  if o.status<>'pending' or o.offer_id is distinct from (p_data->>'offerId')::uuid then raise exception 'OFFER_REQUIRED'; end if;
  select * into q from offers where id=o.offer_id;
  if not exists(select 1 from outbox where order_id=p_id and kind='offer' and payload->'offer'->>'id'=q.id::text and state='sent' and provider_id is not null) then raise exception 'OFFER_NOT_SENT'; end if;
  received := (p_data->>'acceptedAt')::timestamptz;
  if received>now() or received<q.created_at then raise exception 'CONTRACT_EVIDENCE_REQUIRED'; end if;
  if received>q.valid_until then raise exception 'OFFER_EXPIRED'; end if;
  if length(coalesce(p_data->>'acceptanceEmail',''))<30 or length(coalesce(p_data->>'emailMessageId',''))<3 or not coalesce((p_data->>'verifiedSender')::boolean,false) then raise exception 'CONTRACT_EVIDENCE_REQUIRED'; end if;
  early_evidence := trim(coalesce(p_data->>'earlyStartEvidence',''));
  if o.date<(received at time zone 'Europe/Warsaw')::date then raise exception 'PAST_DATE'; end if;
  if o.date<=(received at time zone 'Europe/Warsaw')::date+14 and length(early_evidence)<30 then raise exception 'EARLY_START_REQUIRED'; end if;
  update orders set status='accepted',package_snapshot=q.payload->'package',contract_at=received,contract_evidence=p_data,early_start=length(early_evidence)>=30,documents_snapshot=q.payload->'documents',last_contact_at=now() where id=p_id;
  perform queue_notice(p_id,'contract');
 elsif p_action='hold' then
  if length(coalesce(p_data->>'reason',''))<10 then raise exception 'REASON_REQUIRED'; end if;
  update orders set retention_hold=true,retention_reason=p_data->>'reason' where id=p_id;
 elsif p_action='release_hold' then
  if length(coalesce(p_data->>'message',''))<10 then raise exception 'REASON_REQUIRED'; end if;
  update orders set retention_hold=false,retention_reason='' where id=p_id;
 elsif p_action='status' then
  st := p_data->>'status';
  if st='accepted' then raise exception 'CONTRACT_EVIDENCE_REQUIRED'; end if;
  if st in ('scheduled','in_progress','completed') and o.contract_at is null then raise exception 'CONTRACT_REQUIRED'; end if;
  if st=o.status then return; end if;
  if o.status in ('completed','cancelled','rejected','expired') then raise exception 'TERMINAL_STATUS'; end if;
  if st='completed' and (not coalesce((p_data->>'paymentVerified')::boolean,false) or coalesce((p_data->>'paidAmount')::integer,-1)<0 or length(coalesce(p_data->>'deliveryEmailId',''))<3 or length(coalesce(p_data->>'deliveryEvidence',''))<30 or (p_data->>'receivedAt') is null or (p_data->>'receivedAt')::timestamptz>now()) then raise exception 'DELIVERY_REQUIRED'; end if;
  if st='completed' then update orders set delivery_evidence=p_data where id=p_id; end if;
  if st not in ('accepted','scheduled','in_progress','completed','rejected','cancelled','expired') then raise exception 'INVALID_STATUS'; end if;
  if (o.status='pending' and st not in ('accepted','rejected','cancelled','expired')) or (o.status='accepted' and st not in ('scheduled','in_progress','cancelled')) or (o.status='scheduled' and st not in ('in_progress','cancelled')) or (o.status='in_progress' and st not in ('completed','cancelled')) then raise exception 'INVALID_TRANSITION'; end if;
  if st in ('rejected','cancelled','expired') and length(public_message)<3 then raise exception 'REASON_REQUIRED'; end if;
  update orders set status=st,completed_at=case when st in ('completed','cancelled','rejected','expired') then now() else completed_at end where id=p_id;
  perform queue_notice(p_id,case when st='completed' then 'completed' else 'changed' end,public_message);
 elsif p_action='move' then
  if o.status in ('completed','cancelled','rejected','expired') then raise exception 'TERMINAL_STATUS'; end if;
  target_date := (p_data->>'date')::date; target_cemetery := (p_data->>'cemeteryId')::uuid;
  if target_date=o.date and target_cemetery=o.cemetery_id then return; end if;
  if target_date<(now() at time zone 'Europe/Warsaw')::date then raise exception 'PAST_DATE'; end if;
  if not exists(select 1 from cemeteries where id=target_cemetery and active) then raise exception 'CEMETERY_UNAVAILABLE'; end if;
  if o.contract_at is not null and length(coalesce(p_data->>'agreementEmail',''))<30 then raise exception 'CONTRACT_EVIDENCE_REQUIRED'; end if;
  if o.contract_at is not null and target_date<=(o.contract_at at time zone 'Europe/Warsaw')::date+14 and not o.early_start then raise exception 'EARLY_START_REQUIRED'; end if;
  if o.contract_at is null then update orders set offer_id=null where id=p_id; end if;
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
 update orders set last_contact_at=now() where id=p_id;
 insert into history(order_id,actor,event,details) values(p_id,p_actor,p_action,jsonb_build_object('beforeStatus',o.status,'beforeDate',o.date,'after',p_data));
end $$;


revoke all on all functions in schema public from public,anon,authenticated;
grant execute on all functions in schema public to service_role;

-- Podczas importu zmiana modelu umowy nigdy samodzielnie nie aktywuje sprzedaży.
update public.settings set ready=false;

create function public.retention_candidates() returns jsonb language plpgsql set search_path=public as $$
declare result jsonb;
begin
 perform pg_advisory_xact_lock(7210306);
 -- Ograniczona partia, trwała blokada edycji; przy błędzie Storage następne wywołanie ponawia.
 with candidates as (
  select id from orders where not retention_hold and (
   (contract_at is null and status in ('pending','cancelled','rejected','expired') and last_contact_at<now()-interval '90 days') or
   (completed_at<now()-interval '90 days' and exists(select 1 from attachments where order_id=orders.id))
  ) and not exists(select 1 from outbox where order_id=orders.id and state='sending' and locked_at>now()-interval '5 minutes')
  order by created_at limit 30
 ) update orders set retention_locked=true where id in (select id from candidates);
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'deleteOrder',o.contract_at is null,'paths',coalesce((select jsonb_agg(path) from attachments where order_id=o.id),'[]'::jsonb))),'[]'::jsonb) into result from orders o where o.retention_locked;
 delete from history h where created_at<now()-interval '30 days' and (order_id is null or not exists(select 1 from orders o where o.id=h.order_id and o.retention_hold));
 update outbox set payload='{}' where state in ('sent','cancelled') and (kind<>'offer' or not exists(select 1 from offers q where q.id=(payload->'offer'->>'id')::uuid and q.valid_until>now())) and created_at<now()-interval '30 days' and not exists(select 1 from orders o where o.id=order_id and o.retention_hold);
 delete from rate_limits where expires_at<now();
 return result;
end $$;
create function public.finish_retention(p_id uuid,p_delete_order boolean) returns void language plpgsql set search_path=public as $$
declare o orders;
begin
 perform pg_advisory_xact_lock(7210306);
 select * into o from orders where id=p_id for update;
 if not found then return; end if;
 if not o.retention_locked or o.retention_hold then raise exception 'RETENTION_IN_PROGRESS'; end if;
 delete from attachments where order_id=p_id;
 if p_delete_order and o.contract_at is null then
  delete from outbox where order_id=p_id; delete from history where order_id=p_id;
  update orders set offer_id=null where id=p_id;
  delete from offers where order_id=p_id; delete from orders where id=p_id;
 else update orders set retention_locked=false where id=p_id; end if;
end $$;
create or replace function public.attach_photo(p_order uuid,p_path text,p_size integer) returns void language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(7210306);
 if exists(select 1 from attachments where path=p_path and order_id=p_order) then return; end if;
 if not exists(select 1 from orders where id=p_order and upload_expires_at>now() and not retention_locked) then raise exception 'UNAUTHORIZED'; end if;
 if (select count(*) from attachments where order_id=p_order)>=3 then raise exception 'INVALID_FILE'; end if;
 insert into attachments(order_id,path,type,size) values(p_order,p_path,'image/webp',p_size);
end $$;
revoke all on function public.attach_photo(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.attach_photo(uuid,text,integer) to service_role;
create or replace function public.claim_outbox() returns setof public.outbox language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(7210306);
 return query update outbox set state='sending',locked_at=now(),attempts=attempts+1 where id in
 (select id from outbox where ((state in ('pending','failed') and next_attempt_at<=now()) or (state='sending' and locked_at<now()-interval '5 minutes')) and attempts<8 and not exists(select 1 from orders o where o.id=order_id and o.retention_locked) order by created_at for update skip locked limit 10) returning *;
end $$;

revoke all on all functions in schema public from public,anon,authenticated;
grant execute on all functions in schema public to service_role;
