-- Zgłoszenie ze strony nie zajmuje dnia; dzień wybiera operator podczas konsultacji.
alter table public.orders alter column date drop not null;
alter table public.team_days alter column capacity set default 20;
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
 day := case when p_source='web' then null else nullif(p_input->>'date','')::date end;
 if p_source<>'web' and day is null then raise exception 'DATE_REQUIRED'; end if;
 if day < (now() at time zone 'Europe/Warsaw')::date then raise exception 'PAST_DATE'; end if;
 if p_input->>'variant'<>'single-granite' or not coalesce((p_input->>'terms')::boolean,false) then raise exception 'INVALID_ORDER'; end if;
 if coalesce((p_input->>'earlyStart')::boolean,false) then raise exception 'INVALID_ORDER'; end if;
 if day is not null then left_count := public.capacity_left(c.id,day,p.weight); end if;
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
 if p_action='assign' then
  if o.status<>'pending' or o.contract_at is not null then raise exception 'INVALID_TRANSITION'; end if;
  target_date := (p_data->>'date')::date;
  if target_date is null then raise exception 'DATE_REQUIRED'; end if;
  if target_date<(now() at time zone 'Europe/Warsaw')::date then raise exception 'PAST_DATE'; end if;
  if target_date=o.date then return; end if;
  if exists(select 1 from outbox where order_id=p_id and kind='offer' and state='sending') then raise exception 'OFFER_SENDING'; end if;
  update orders set status='cancelled' where id=p_id;
  l := capacity_left(o.cemetery_id,target_date,o.weight);
  if l is not null and l<1 then raise exception 'FULL'; end if;
  update orders set date=target_date,status=o.status,offer_id=null where id=p_id;
  update outbox set state='cancelled',payload='{}',last_error='SUPERSEDED' where order_id=p_id and kind='offer' and state in ('pending','failed');
 elsif p_action='offer' then
  if o.date is null then raise exception 'DATE_REQUIRED'; end if;
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
  if o.date is null then raise exception 'DATE_REQUIRED'; end if;
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
  if o.contract_at is null then
   if exists(select 1 from outbox where order_id=p_id and kind='offer' and state='sending') then raise exception 'OFFER_SENDING'; end if;
   update orders set offer_id=null where id=p_id;
   update outbox set state='cancelled',payload='{}',last_error='SUPERSEDED' where order_id=p_id and kind='offer' and state in ('pending','failed');
  end if;
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



revoke all on function public.reserve_order(jsonb,text,text,text,text) from public,anon,authenticated;
revoke all on function public.admin_change(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.reserve_order(jsonb,text,text,text,text) to service_role;
grant execute on function public.admin_change(uuid,text,jsonb,text) to service_role;
-- Limit ekipy jest wspólny dla wszystkich cmentarzy. Zachowaj istniejące przypisania.
do $$ begin
 if exists(select 1 from public.orders where date between '2026-10-24' and '2026-10-31' and status in ('pending','accepted','scheduled','in_progress','completed') group by date having sum(weight)>20) then
  raise exception 'CAPACITY_BELOW_OCCUPANCY';
 end if;
 update public.team_days set capacity=20 where date between '2026-10-24' and '2026-10-31';
end $$;
