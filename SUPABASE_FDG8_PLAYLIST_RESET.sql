-- TangoNest FDG8 playlist semantics and requested clean state.
-- This keeps Auth users, deletes all learning data, and creates exactly one
-- empty, ordinary-looking "New Playlist" for every account.

begin;

drop index if exists public.tn_playlists_one_my_words_per_user_idx;

create or replace function public.tn_ensure_default_playlist()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_playlist public.tn_playlists%rowtype;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));

  select * into v_playlist
  from public.tn_playlists
  where user_id=v_user_id
  order by case when is_default then 0 else 1 end,created_at,id
  limit 1;

  if not found then
    insert into public.tn_playlists(user_id,name,is_default)
    values (v_user_id,'New Playlist',false)
    returning * into v_playlist;
  end if;

  update public.tn_playlists
  set is_default=false
  where user_id=v_user_id and is_default and id<>v_playlist.id;

  update public.tn_playlists
  set is_default=true
  where id=v_playlist.id and user_id=v_user_id and is_default is distinct from true;

  select * into v_playlist
  from public.tn_playlists
  where id=v_playlist.id and user_id=v_user_id;
  return to_jsonb(v_playlist);
end;
$$;

create or replace function public.tn_delete_playlist(p_playlist_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_target public.tn_playlists%rowtype;
  v_replacement_id uuid;
  v_moved integer := 0;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));

  select * into v_target
  from public.tn_playlists
  where id=p_playlist_id and user_id=v_user_id
  for update;
  if not found then raise exception 'Playlist not found'; end if;

  if v_target.is_default then
    update public.tn_playlists set is_default=false
    where id=v_target.id and user_id=v_user_id;

    select id into v_replacement_id
    from public.tn_playlists
    where user_id=v_user_id and id<>v_target.id
    order by created_at,id limit 1 for update;

    if v_replacement_id is null then
      insert into public.tn_playlists(user_id,name,is_default)
      values (v_user_id,'New Playlist',true)
      returning id into v_replacement_id;
    else
      update public.tn_playlists set is_default=true
      where id=v_replacement_id and user_id=v_user_id;
    end if;
  end if;

  update public.tn_words
  set playlist_id=null,content_updated_at=now(),updated_at=now()
  where user_id=v_user_id and playlist_id=p_playlist_id;
  get diagnostics v_moved=row_count;

  delete from public.tn_playlists
  where id=p_playlist_id and user_id=v_user_id;

  return jsonb_build_object(
    'deleted',p_playlist_id,
    'unfiled_words',v_moved,
    'replacement_playlist_id',v_replacement_id
  );
end;
$$;

create or replace function public.tn_delete_all_account_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_playlist_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));
  delete from public.tn_learning_events where user_id=v_user_id;
  delete from public.tn_words where user_id=v_user_id;
  delete from public.tn_playlists where user_id=v_user_id;
  insert into public.tn_playlists(user_id,name,is_default)
  values (v_user_id,'New Playlist',true)
  returning id into v_playlist_id;
  return jsonb_build_object('words',0,'lists',1,'playlist_id',v_playlist_id);
end;
$$;

create or replace function public.tn_apply_account_isolation_reset_v2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_migration_key constant text := 'account-isolation-reset-v2';
  v_playlist_id uuid;
  v_word_count integer;
  v_list_count integer;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));
  if exists(select 1 from public.tn_account_migrations where user_id=v_user_id and migration_key=v_migration_key) then
    select count(*) into v_word_count from public.tn_words where user_id=v_user_id;
    select count(*) into v_list_count from public.tn_playlists where user_id=v_user_id;
    return jsonb_build_object('applied',false,'words',v_word_count,'lists',v_list_count,'migration',v_migration_key);
  end if;
  delete from public.tn_learning_events where user_id=v_user_id;
  delete from public.tn_words where user_id=v_user_id;
  delete from public.tn_playlists where user_id=v_user_id;
  insert into public.tn_playlists(user_id,name,is_default)
  values (v_user_id,'New Playlist',true)
  returning id into v_playlist_id;
  insert into public.tn_account_migrations(user_id,migration_key)
  values (v_user_id,v_migration_key)
  on conflict (user_id,migration_key) do nothing;
  return jsonb_build_object('applied',true,'words',0,'lists',1,'playlist_id',v_playlist_id,'migration',v_migration_key);
end;
$$;

-- Requested project-wide clean state. Auth identities are intentionally kept.
do $$
declare
  v_key constant text := 'fdg8-user-authorized-learning-reset-v1';
begin
  perform pg_advisory_xact_lock(hashtextextended(v_key,0));
  if not exists(select 1 from public.tn_system_migrations where migration_key=v_key) then
    delete from public.tn_learning_events;
    delete from public.tn_words;
    delete from public.tn_playlists;
    insert into public.tn_playlists(user_id,name,is_default)
    select id,'New Playlist',true from auth.users;
    insert into public.tn_account_migrations(user_id,migration_key)
    select id,'account-isolation-reset-v2' from auth.users
    on conflict (user_id,migration_key) do nothing;
    insert into public.tn_system_migrations(migration_key) values (v_key);
  end if;
end $$;

revoke execute on function public.tn_ensure_default_playlist() from public,anon;
revoke execute on function public.tn_delete_playlist(uuid) from public,anon;
revoke execute on function public.tn_delete_all_account_data() from public,anon;
revoke execute on function public.tn_apply_account_isolation_reset_v2() from public,anon;
grant execute on function public.tn_ensure_default_playlist() to authenticated;
grant execute on function public.tn_delete_playlist(uuid) to authenticated;
grant execute on function public.tn_delete_all_account_data() to authenticated;
grant execute on function public.tn_apply_account_isolation_reset_v2() to authenticated;

commit;

-- Verification: every Auth account must now have zero words and exactly one
-- ordinary, renameable/deletable playlist named "New Playlist".
select
  (select count(*) from public.tn_words) as total_words,
  (select count(*) from public.tn_playlists) as total_playlists,
  (select count(*) from auth.users) as total_accounts,
  (select count(*) from public.tn_playlists where name = 'New Playlist') as new_playlist_rows,
  (
    select count(*)
    from (
      select u.id
      from auth.users u
      left join public.tn_playlists p on p.user_id = u.id
      group by u.id
      having count(p.id) <> 1
    ) invalid_accounts
  ) as accounts_with_invalid_playlist_count;
