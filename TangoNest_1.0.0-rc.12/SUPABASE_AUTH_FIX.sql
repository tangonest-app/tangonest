-- TangoNest rc.12: idempotent Auth, schema, grant, and RLS repair
-- Run this entire file once in Supabase SQL Editor.
-- It does not delete playlists, words, users, or learning history.

begin;

create extension if not exists pgcrypto;

create table if not exists public.tn_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tn_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  playlist_id uuid not null references public.tn_playlists(id) on delete cascade,
  front text not null,
  back text not null,
  front_lang text not null default 'en-US',
  back_lang text not null default 'ja-JP',
  pos text,
  gender text,
  tags text,
  memo text,
  pronunciation text,
  status text not null default 'new',
  saved boolean not null default false,
  level integer not null default 1,
  next_review date default current_date,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  review_count integer not null default 0,
  last_answered_at timestamptz,
  last_wrong_at timestamptz,
  consecutive_correct integer not null default 0,
  review_interval_days integer not null default 0,
  last_result text,
  learning_state text not null default 'new',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tn_learning_events (
  event_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.tn_words(id) on delete cascade,
  rating text not null,
  mode text not null default 'study',
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Repair columns that were missing from earlier TangoNest schemas.
alter table public.tn_playlists add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tn_playlists add column if not exists name text;
alter table public.tn_playlists add column if not exists created_at timestamptz not null default now();
alter table public.tn_playlists add column if not exists updated_at timestamptz not null default now();

alter table public.tn_words add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tn_words add column if not exists playlist_id uuid references public.tn_playlists(id) on delete cascade;
alter table public.tn_words add column if not exists front text;
alter table public.tn_words add column if not exists back text;
alter table public.tn_words add column if not exists front_lang text not null default 'en-US';
alter table public.tn_words add column if not exists back_lang text not null default 'ja-JP';
alter table public.tn_words add column if not exists pos text;
alter table public.tn_words add column if not exists gender text;
alter table public.tn_words add column if not exists tags text;
alter table public.tn_words add column if not exists memo text;
alter table public.tn_words add column if not exists pronunciation text;
alter table public.tn_words add column if not exists status text not null default 'new';
alter table public.tn_words add column if not exists saved boolean not null default false;
alter table public.tn_words add column if not exists level integer not null default 1;
alter table public.tn_words add column if not exists next_review date default current_date;
alter table public.tn_words add column if not exists correct_count integer not null default 0;
alter table public.tn_words add column if not exists wrong_count integer not null default 0;
alter table public.tn_words add column if not exists review_count integer not null default 0;
alter table public.tn_words add column if not exists last_answered_at timestamptz;
alter table public.tn_words add column if not exists last_wrong_at timestamptz;
alter table public.tn_words add column if not exists consecutive_correct integer not null default 0;
alter table public.tn_words add column if not exists review_interval_days integer not null default 0;
alter table public.tn_words add column if not exists last_result text;
alter table public.tn_words add column if not exists learning_state text not null default 'new';
alter table public.tn_words add column if not exists position integer not null default 0;
alter table public.tn_words add column if not exists created_at timestamptz not null default now();
alter table public.tn_words add column if not exists updated_at timestamptz not null default now();

alter table public.tn_learning_events add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tn_learning_events add column if not exists word_id uuid references public.tn_words(id) on delete cascade;
alter table public.tn_learning_events add column if not exists rating text;
alter table public.tn_learning_events add column if not exists mode text not null default 'study';
alter table public.tn_learning_events add column if not exists answered_at timestamptz not null default now();
alter table public.tn_learning_events add column if not exists created_at timestamptz not null default now();

create index if not exists tn_playlists_user_id_created_at_idx on public.tn_playlists(user_id,created_at);
create index if not exists tn_words_user_id_created_at_idx on public.tn_words(user_id,created_at);
create index if not exists tn_words_playlist_id_position_idx on public.tn_words(playlist_id,position,created_at);
create index if not exists tn_learning_events_user_word_idx on public.tn_learning_events(user_id,word_id,answered_at desc);

alter table public.tn_playlists enable row level security;
alter table public.tn_words enable row level security;
alter table public.tn_learning_events enable row level security;

-- Replace inconsistent policies with one predictable owner-only policy set.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname,tablename,policyname
    from pg_policies
    where schemaname='public'
      and tablename in ('tn_playlists','tn_words','tn_learning_events')
  loop
    execute format('drop policy if exists %I on %I.%I',policy_row.policyname,policy_row.schemaname,policy_row.tablename);
  end loop;
end $$;

create policy tn_playlists_select_own on public.tn_playlists for select to authenticated using (auth.uid()=user_id);
create policy tn_playlists_insert_own on public.tn_playlists for insert to authenticated with check (auth.uid()=user_id);
create policy tn_playlists_update_own on public.tn_playlists for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy tn_playlists_delete_own on public.tn_playlists for delete to authenticated using (auth.uid()=user_id);

create policy tn_words_select_own on public.tn_words for select to authenticated using (auth.uid()=user_id);
create policy tn_words_insert_own on public.tn_words for insert to authenticated with check (auth.uid()=user_id);
create policy tn_words_update_own on public.tn_words for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy tn_words_delete_own on public.tn_words for delete to authenticated using (auth.uid()=user_id);

create policy tn_learning_events_select_own on public.tn_learning_events for select to authenticated using (auth.uid()=user_id);
create policy tn_learning_events_insert_own on public.tn_learning_events for insert to authenticated with check (auth.uid()=user_id);

revoke all on table public.tn_playlists, public.tn_words, public.tn_learning_events from anon;
grant usage on schema public to authenticated;
grant select,insert,update,delete on table public.tn_playlists to authenticated;
grant select,insert,update,delete on table public.tn_words to authenticated;
grant select,insert on table public.tn_learning_events to authenticated;

do $$
begin
  if to_regprocedure('public.tn_record_learning_result(uuid,text,text,uuid,timestamptz,date)') is not null then
    execute 'revoke execute on function public.tn_record_learning_result(uuid,text,text,uuid,timestamptz,date) from public, anon';
    execute 'grant execute on function public.tn_record_learning_result(uuid,text,text,uuid,timestamptz,date) to authenticated';
  end if;
  if to_regprocedure('public.tn_delete_playlist_with_fallback(uuid)') is not null then
    execute 'revoke execute on function public.tn_delete_playlist_with_fallback(uuid) from public, anon';
    execute 'grant execute on function public.tn_delete_playlist_with_fallback(uuid) to authenticated';
  end if;
  if to_regprocedure('public.tn_delete_all_account_data()') is not null then
    execute 'revoke execute on function public.tn_delete_all_account_data() from public, anon';
    execute 'grant execute on function public.tn_delete_all_account_data() to authenticated';
  end if;
  if to_regprocedure('public.tn_import_snapshot(jsonb)') is not null then
    execute 'revoke execute on function public.tn_import_snapshot(jsonb) from public, anon';
    execute 'grant execute on function public.tn_import_snapshot(jsonb) to authenticated';
  end if;
end $$;

alter table public.tn_playlists replica identity full;
alter table public.tn_words replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tn_playlists') then
      alter publication supabase_realtime add table public.tn_playlists;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tn_words') then
      alter publication supabase_realtime add table public.tn_words;
    end if;
  end if;
end $$;

-- Fail the migration if the exact production permissions are still missing.
do $$
begin
  if not (
    has_table_privilege('authenticated','public.tn_playlists','SELECT')
    and has_table_privilege('authenticated','public.tn_playlists','INSERT')
    and has_table_privilege('authenticated','public.tn_playlists','UPDATE')
    and has_table_privilege('authenticated','public.tn_playlists','DELETE')
  ) then
    raise exception 'authenticated role still lacks tn_playlists CRUD';
  end if;
  if not (
    has_table_privilege('authenticated','public.tn_words','SELECT')
    and has_table_privilege('authenticated','public.tn_words','INSERT')
    and has_table_privilege('authenticated','public.tn_words','UPDATE')
    and has_table_privilege('authenticated','public.tn_words','DELETE')
  ) then
    raise exception 'authenticated role still lacks tn_words CRUD';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tn_words' and column_name='position'
  ) then
    raise exception 'tn_words.position is still missing';
  end if;
end $$;

notify pgrst,'reload schema';

commit;
