-- Separate queue claim for automatic owner alerts; client correspondence stays manual.
create function public.claim_owner_outbox() returns setof public.outbox language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(7210306);
 return query update outbox set state='sending',locked_at=now(),attempts=attempts+1 where id in
 (select m.id from outbox m where m.kind='owner' and m.recipient='czystypomnikwarszawa@gmail.com'
 and ((m.state in ('pending','failed') and m.next_attempt_at<=now()) or (m.state='sending' and m.locked_at<now()-interval '5 minutes'))
 and m.attempts<8 and not exists(select 1 from orders o where o.id=m.order_id and o.retention_locked)
 order by m.created_at,m.id for update skip locked limit 2) returning *;
end $$;
revoke all on function public.claim_owner_outbox() from public,anon,authenticated;
grant execute on function public.claim_owner_outbox() to service_role;
