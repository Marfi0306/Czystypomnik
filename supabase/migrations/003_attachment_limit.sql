create function public.attach_photo(p_order uuid,p_path text,p_size integer) returns void language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(7210306);
 if exists(select 1 from attachments where path=p_path and order_id=p_order) then return; end if;
 if not exists(select 1 from orders where id=p_order and upload_expires_at>now()) then raise exception 'UNAUTHORIZED'; end if;
 if (select count(*) from attachments where order_id=p_order)>=3 then raise exception 'INVALID_FILE'; end if;
 insert into attachments(order_id,path,type,size) values(p_order,p_path,'image/webp',p_size);
end $$;
revoke all on function public.attach_photo(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.attach_photo(uuid,text,integer) to service_role;
