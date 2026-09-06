-- FDG10 non-destructive compatibility safety migration.
-- Run once (safe to repeat) in the existing project SQL editor.
-- No user data, policies, tables or account identities are deleted.
begin;

-- Compatibility endpoints for old cached clients. Authentication must never reset data.
create or replace function public.tn_apply_account_clean_start_v1()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  return jsonb_build_object(
    'applied',false,
    'disabled',true,
    'words',(select count(*) from public.tn_words where user_id=v_user_id),
    'lists',(select count(*) from public.tn_playlists where user_id=v_user_id)
  );
end;
$$;

create or replace function public.tn_apply_account_isolation_reset_v2()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.tn_apply_account_clean_start_v1();
$$;

revoke execute on function public.tn_apply_account_clean_start_v1() from public, anon;
revoke execute on function public.tn_apply_account_isolation_reset_v2() from public, anon;
grant execute on function public.tn_apply_account_clean_start_v1() to authenticated;
grant execute on function public.tn_apply_account_isolation_reset_v2() to authenticated;
notify pgrst, 'reload schema';
commit;
