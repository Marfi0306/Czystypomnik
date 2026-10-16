-- Ręczna korespondencja z firmowej skrzynki; wysłanie wymaga dowodu operatora.
create function public.record_manual_mail(p_id uuid,p_message_id text,p_sent_at timestamptz,p_actor text) returns void language plpgsql set search_path=public as $$
declare m outbox; o orders;
begin
 perform pg_advisory_xact_lock(7210306);
 select * into m from outbox where id=p_id for update;
 if not found or m.state not in ('pending','failed') then raise exception 'INVALID_TRANSITION'; end if;
 select * into o from orders where id=m.order_id for update;
 if o.retention_locked then raise exception 'RETENTION_IN_PROGRESS'; end if;
 if m.kind='owner' then
  update outbox set state='cancelled',last_error='READ_IN_DASHBOARD',payload='{}' where id=p_id;
 else
  if length(trim(p_message_id))<3 or p_sent_at is null or p_sent_at<m.created_at-interval '1 minute' or p_sent_at>now()+interval '1 minute' then raise exception 'MAIL_EVIDENCE_REQUIRED'; end if;
  if m.kind='offer' and (o.offer_id::text<>m.payload->'offer'->>'id' or (m.payload->'offer'->>'validUntil')::timestamptz<p_sent_at) then raise exception 'OFFER_EXPIRED'; end if;
  update outbox set state='sent',provider_id='manual:'||trim(p_message_id),last_error=null where id=p_id;
 end if;
 insert into history(order_id,actor,event,details) values(m.order_id,p_actor,'manual_mail',jsonb_build_object('outboxId',p_id,'kind',m.kind,'messageId',case when m.kind='owner' then 'dashboard' else p_message_id end,'sentAt',p_sent_at));
end $$;
revoke all on function public.record_manual_mail(uuid,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.record_manual_mail(uuid,text,timestamptz,text) to service_role;
