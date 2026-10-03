create or replace function public.delete_user(user_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  deleted_users integer;
begin
  delete from public.payment p
  where p.payed_by = user_id;

  delete from public.users u
  where u.id = user_id;

  get diagnostics deleted_users = row_count;

  if deleted_users <> 1 then
    raise exception 'Expected to delete exactly one user, but deleted %', deleted_users;
  end if;

  return deleted_users;
end;
$$;
