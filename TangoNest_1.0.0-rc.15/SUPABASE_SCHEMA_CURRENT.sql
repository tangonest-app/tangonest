-- TangoNest v1.0.0-rc14 canonical production schema
-- Run in Supabase SQL Editor.
--
-- IMPORTANT:
-- This migration preserves existing playlists and words.
-- Destructive operations only run later when the user explicitly chooses
-- Import Replace or Delete All Account Data inside TangoNest.

begin;

create extension if not exists pgcrypto;

-- Retire the old custom no-email auth RPC path.
drop function if exists public.tn_save(text,text,jsonb);
drop function if exists public.tn_login(text,text);
drop function if exists public.tn_signup(text,text,jsonb);
create table if not exists public.tn_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tn_playlists_id_user_unique unique (id, user_id),
  constraint tn_playlists_name_not_blank check (length(btrim(name)) > 0)
);

create table if not exists public.tn_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  playlist_id uuid,
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
  content_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tn_words_front_not_blank check (length(btrim(front)) > 0),
  constraint tn_words_back_not_blank check (length(btrim(back)) > 0),
  constraint tn_words_level_range check (level between 1 and 5),
  constraint tn_words_status_check check (status in ('new','learned','hard')),
  constraint tn_words_playlist_user_fk
    foreign key (playlist_id, user_id)
    references public.tn_playlists(id, user_id)
);

alter table public.tn_words add column if not exists consecutive_correct integer not null default 0;
alter table public.tn_words add column if not exists review_interval_days integer not null default 0;
alter table public.tn_words add column if not exists last_result text;
alter table public.tn_words add column if not exists learning_state text not null default 'new';
alter table public.tn_words add column if not exists content_updated_at timestamptz not null default now();

-- Playlists are optional. "All Words" is a virtual client view, never a row.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conname as constraint_name
    from pg_constraint c
    where c.conrelid = 'public.tn_words'::regclass
      and c.contype = 'f'
      and exists (
        select 1
        from unnest(c.conkey) as k(attnum)
        join pg_attribute a
          on a.attrelid = c.conrelid
         and a.attnum = k.attnum
        where a.attname = 'playlist_id'
      )
  loop
    execute format('alter table public.tn_words drop constraint %I',v_constraint.constraint_name);
  end loop;
end $$;

alter table public.tn_words alter column playlist_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tn_words'::regclass
      and conname = 'tn_words_playlist_user_fk'
  ) then
    alter table public.tn_words
      add constraint tn_words_playlist_user_fk
      foreign key (playlist_id,user_id)
      references public.tn_playlists(id,user_id);
  end if;
end $$;

create table if not exists public.tn_learning_events (
  event_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.tn_words(id) on delete cascade,
  rating text not null,
  mode text not null default 'study',
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint tn_learning_events_rating_check check (rating in ('again','hard','good','easy'))
);

create or replace function public.tn_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tn_playlists_touch_updated_at on public.tn_playlists;
create trigger tn_playlists_touch_updated_at
before update on public.tn_playlists
for each row execute function public.tn_touch_updated_at();

drop trigger if exists tn_words_touch_updated_at on public.tn_words;
create trigger tn_words_touch_updated_at
before update on public.tn_words
for each row execute function public.tn_touch_updated_at();

create index if not exists tn_playlists_user_id_created_at_idx
  on public.tn_playlists(user_id, created_at);

create index if not exists tn_words_user_id_created_at_idx
  on public.tn_words(user_id, created_at);

create index if not exists tn_words_playlist_id_position_idx
  on public.tn_words(playlist_id, position, created_at);

create index if not exists tn_words_user_saved_idx
  on public.tn_words(user_id, saved);

create index if not exists tn_learning_events_user_word_idx
  on public.tn_learning_events(user_id, word_id, answered_at desc);

alter table public.tn_playlists enable row level security;
alter table public.tn_words enable row level security;
alter table public.tn_learning_events enable row level security;

drop policy if exists "tn_playlists_select_own" on public.tn_playlists;
drop policy if exists "tn_playlists_insert_own" on public.tn_playlists;
drop policy if exists "tn_playlists_update_own" on public.tn_playlists;
drop policy if exists "tn_playlists_delete_own" on public.tn_playlists;
drop policy if exists "tn_words_select_own" on public.tn_words;
drop policy if exists "tn_words_insert_own" on public.tn_words;
drop policy if exists "tn_words_update_own" on public.tn_words;
drop policy if exists "tn_words_delete_own" on public.tn_words;
drop policy if exists "tn_learning_events_select_own" on public.tn_learning_events;
drop policy if exists "tn_learning_events_insert_own" on public.tn_learning_events;

create policy "tn_playlists_select_own"
on public.tn_playlists
for select
to authenticated
using (auth.uid() = user_id);

create policy "tn_playlists_insert_own"
on public.tn_playlists
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "tn_playlists_update_own"
on public.tn_playlists
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "tn_playlists_delete_own"
on public.tn_playlists
for delete
to authenticated
using (auth.uid() = user_id);

create policy "tn_words_select_own"
on public.tn_words
for select
to authenticated
using (auth.uid() = user_id);

create policy "tn_words_insert_own"
on public.tn_words
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "tn_words_update_own"
on public.tn_words
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "tn_words_delete_own"
on public.tn_words
for delete
to authenticated
using (auth.uid() = user_id);

create policy "tn_learning_events_select_own"
on public.tn_learning_events
for select
to authenticated
using (auth.uid() = user_id);

create policy "tn_learning_events_insert_own"
on public.tn_learning_events
for insert
to authenticated
with check (auth.uid() = user_id);

alter table public.tn_playlists replica identity full;
alter table public.tn_words replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tn_playlists'
    ) then
      alter publication supabase_realtime add table public.tn_playlists;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tn_words'
    ) then
      alter publication supabase_realtime add table public.tn_words;
    end if;
  end if;
end;
$$;

create or replace function public.tn_record_learning_result(
  p_word_id uuid,
  p_rating text,
  p_mode text,
  p_event_id uuid,
  p_answered_at timestamptz,
  p_local_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_word public.tn_words%rowtype;
  v_inserted uuid;
  v_rating text := lower(btrim(coalesce(p_rating,'')));
  v_mode text := left(coalesce(nullif(btrim(p_mode),''),'study'),40);
  v_event_id uuid := coalesce(p_event_id,gen_random_uuid());
  v_answered_at timestamptz := coalesce(p_answered_at,now());
  v_local_date date := coalesce(p_local_date,current_date);
  v_correct integer;
  v_wrong integer;
  v_reviews integer;
  v_consecutive integer;
  v_level integer;
  v_interval integer;
  v_accuracy numeric;
  v_state text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if v_rating not in ('again','hard','good','easy') then
    raise exception 'Invalid learning rating';
  end if;

  select *
  into v_word
  from public.tn_words
  where id = p_word_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Word not found';
  end if;

  insert into public.tn_learning_events(event_id,user_id,word_id,rating,mode,answered_at)
  values (v_event_id,v_user_id,p_word_id,v_rating,v_mode,v_answered_at)
  on conflict (event_id) do nothing
  returning event_id into v_inserted;

  if v_inserted is null then
    return jsonb_build_object('duplicate',true,'word',to_jsonb(v_word));
  end if;

  v_correct := coalesce(v_word.correct_count,0) + case when v_rating in ('good','easy') then 1 else 0 end;
  v_wrong := coalesce(v_word.wrong_count,0) + case when v_rating = 'again' then 1 else 0 end;
  v_reviews := coalesce(v_word.review_count,0) + 1;

  if v_word.last_answered_at is not null and v_answered_at < v_word.last_answered_at then
    update public.tn_words
    set correct_count = v_correct,
        wrong_count = v_wrong,
        review_count = v_reviews,
        last_wrong_at = case
          when v_rating = 'again'
            and (v_word.last_wrong_at is null or v_answered_at > v_word.last_wrong_at)
          then v_answered_at
          else v_word.last_wrong_at
        end,
        updated_at = now()
    where id = p_word_id
      and user_id = v_user_id
    returning * into v_word;

    return jsonb_build_object('duplicate',false,'out_of_order',true,'word',to_jsonb(v_word));
  end if;

  v_consecutive := case
    when v_rating in ('good','easy') then coalesce(v_word.consecutive_correct,0) + 1
    when v_rating = 'hard' then greatest(0,coalesce(v_word.consecutive_correct,0) - 1)
    else 0
  end;
  v_accuracy := case when v_correct + v_wrong > 0 then v_correct::numeric / (v_correct + v_wrong) else 0 end;

  v_level := case
    when v_reviews = 0 then 1
    when v_correct >= 5 and v_reviews >= 5 and v_accuracy >= 0.7 and v_consecutive >= 2 then 4
    when v_correct >= 3 and v_reviews >= 3 and v_accuracy >= 0.55 and v_consecutive >= 1 then 3
    when v_correct >= 1 then 2
    else 1
  end;

  if v_rating = 'again' then
    v_level := case when coalesce(v_word.level,1) >= 5 then 3 else greatest(1,least(v_level,coalesce(v_word.level,1)-1)) end;
  elsif v_rating = 'hard' then
    v_level := case when coalesce(v_word.level,1) >= 5 then 4 else greatest(1,least(v_level,coalesce(v_word.level,1))) end;
  elsif v_rating = 'easy' and v_level < 4 and v_correct >= 3 then
    v_level := least(4,v_level+1);
  end if;

  v_interval := case
    when v_rating = 'again' then 0
    when v_rating = 'hard' then greatest(1,least(7,round(coalesce(v_word.review_interval_days,0)*0.6)::integer))
    when v_rating = 'easy' then least(180,greatest(
      case v_level when 1 then 2 when 2 then 4 when 3 then 8 when 4 then 18 else 45 end,
      round(coalesce(v_word.review_interval_days,0)*2.2)::integer
    ))
    else least(180,greatest(
      case v_level when 1 then 1 when 2 then 2 when 3 then 4 when 4 then 14 else 30 end,
      round(coalesce(v_word.review_interval_days,0)*1.7)::integer
    ))
  end;

  if v_correct >= 6
    and v_reviews >= 6
    and v_consecutive >= 3
    and v_accuracy >= 0.8
    and v_interval >= 21
    and v_rating in ('good','easy') then
    v_level := 5;
    v_interval := greatest(30,v_interval);
  elsif v_level >= 5 then
    v_level := 4;
  end if;

  v_state := case
    when v_level = 5 then 'mastered'
    when v_rating in ('again','hard') then 'weak'
    when v_word.last_wrong_at is not null
      and v_word.last_wrong_at >= v_answered_at - interval '14 days'
      and v_consecutive < 2 then 'weak'
    when v_reviews >= 3 and v_accuracy < 0.6 then 'weak'
    when v_local_date + v_interval <= v_local_date then 'review'
    else 'learning'
  end;

  update public.tn_words
  set correct_count = v_correct,
      wrong_count = v_wrong,
      review_count = v_reviews,
      consecutive_correct = v_consecutive,
      level = v_level,
      review_interval_days = v_interval,
      last_result = v_rating,
      learning_state = v_state,
      status = case when v_state = 'mastered' then 'learned' when v_state = 'weak' then 'hard' else 'new' end,
      next_review = v_local_date + v_interval,
      last_answered_at = v_answered_at,
      last_wrong_at = case when v_rating = 'again' then v_answered_at else v_word.last_wrong_at end,
      updated_at = now()
  where id = p_word_id
    and user_id = v_user_id
  returning * into v_word;

  return jsonb_build_object('duplicate',false,'word',to_jsonb(v_word));
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
  v_moved integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_target
  from public.tn_playlists
  where id = p_playlist_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Playlist not found';
  end if;

  update public.tn_words
  set playlist_id = null,
      content_updated_at = now(),
      updated_at = now()
  where user_id = v_user_id
    and playlist_id = p_playlist_id;
  get diagnostics v_moved = row_count;

  delete from public.tn_playlists
  where id = p_playlist_id
    and user_id = v_user_id;

  return jsonb_build_object('deleted',p_playlist_id,'unfiled_words',v_moved);
end;
$$;

drop function if exists public.tn_delete_playlist_with_fallback(uuid);

create or replace function public.tn_delete_all_account_data()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.tn_words where user_id = v_user_id;
  delete from public.tn_playlists where user_id = v_user_id;

  return jsonb_build_object('words',0,'lists',0);
end;
$$;

create or replace function public.tn_import_snapshot(p_data jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_list jsonb;
  v_word jsonb;
  v_old_list_id text;
  v_new_list_id uuid;
  v_list_map jsonb := '{}'::jsonb;
  v_list_count integer := 0;
  v_word_count integer := 0;
  v_front text;
  v_back text;
  v_status text;
  v_level integer;
  v_position integer;
  v_next_review date;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if jsonb_typeof(coalesce(p_data->'lists','[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_data->'words','[]'::jsonb)) <> 'array' then
    raise exception 'Invalid import data';
  end if;

  delete from public.tn_words where user_id = v_user_id;
  delete from public.tn_playlists where user_id = v_user_id;

  for v_list in select value from jsonb_array_elements(coalesce(p_data->'lists','[]'::jsonb))
  loop
    v_old_list_id := coalesce(nullif(v_list->>'id',''), gen_random_uuid()::text);
    insert into public.tn_playlists(user_id,name)
    values (v_user_id, coalesce(nullif(btrim(v_list->>'name'),''),'Imported Playlist'))
    returning id into v_new_list_id;

    v_list_map := v_list_map || jsonb_build_object(v_old_list_id, v_new_list_id::text);
    v_list_count := v_list_count + 1;
  end loop;

  for v_word in select value from jsonb_array_elements(coalesce(p_data->'words','[]'::jsonb))
  loop
    v_front := nullif(btrim(v_word->>'front'),'');
    v_back := nullif(btrim(v_word->>'back'),'');
    if v_front is null or v_back is null then
      continue;
    end if;

    v_old_list_id := v_word->>'listId';
    v_new_list_id := nullif(v_list_map->>v_old_list_id,'')::uuid;
    v_status := case when v_word->>'status' in ('new','learned','hard') then v_word->>'status' else 'new' end;
    v_level := case
      when coalesce(v_word->>'level','') ~ '^\d+$'
        then least(5,greatest(1,(v_word->>'level')::integer))
      else 1
    end;
    v_position := case
      when coalesce(v_word->>'position','') ~ '^\d+$' then (v_word->>'position')::integer
      else v_word_count
    end;
    v_next_review := case
      when coalesce(v_word->>'nextReview','') ~ '^\d{4}-\d{2}-\d{2}$' then (v_word->>'nextReview')::date
      else current_date
    end;

    insert into public.tn_words(
      user_id,playlist_id,front,back,front_lang,back_lang,pos,gender,tags,memo,pronunciation,
      status,saved,level,next_review,correct_count,wrong_count,review_count,
      consecutive_correct,review_interval_days,last_result,learning_state,last_answered_at,last_wrong_at,position
    )
    values (
      v_user_id,
      v_new_list_id,
      v_front,
      v_back,
      coalesce(nullif(v_word->>'frontLang',''),'en-US'),
      coalesce(nullif(v_word->>'backLang',''),'ja-JP'),
      nullif(btrim(v_word->>'pos'),''),
      nullif(btrim(v_word->>'gender'),''),
      nullif(btrim(v_word->>'tags'),''),
      nullif(btrim(v_word->>'memo'),''),
      nullif(btrim(v_word->>'pronunciation'),''),
      v_status,
      lower(coalesce(v_word->>'saved','false')) in ('true','1','yes','on'),
      v_level,
      v_next_review,
      case when coalesce(v_word->>'correctCount','') ~ '^\d+$' then (v_word->>'correctCount')::integer else 0 end,
      case when coalesce(v_word->>'wrongCount','') ~ '^\d+$' then (v_word->>'wrongCount')::integer else 0 end,
      case when coalesce(v_word->>'reviewCount','') ~ '^\d+$' then (v_word->>'reviewCount')::integer else 0 end,
      case when coalesce(v_word->>'consecutiveCorrect','') ~ '^\d+$' then (v_word->>'consecutiveCorrect')::integer else 0 end,
      case when coalesce(v_word->>'reviewIntervalDays','') ~ '^\d+$' then (v_word->>'reviewIntervalDays')::integer else 0 end,
      case when v_word->>'lastResult' in ('again','hard','good','easy') then v_word->>'lastResult' else null end,
      case when v_word->>'learningState' in ('new','learning','review','weak','mastered') then v_word->>'learningState' else 'new' end,
      case when coalesce(v_word->>'lastAnsweredAt','') ~ '^\d{4}-\d{2}-\d{2}T' then (v_word->>'lastAnsweredAt')::timestamptz else null end,
      case when coalesce(v_word->>'lastWrongAt','') ~ '^\d{4}-\d{2}-\d{2}T' then (v_word->>'lastWrongAt')::timestamptz else null end,
      v_position
    );
    v_word_count := v_word_count + 1;
  end loop;

  return jsonb_build_object('lists',v_list_count,'words',v_word_count);
end;
$$;

create or replace function public.tn_upsert_word_nonlearning(p_word jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_playlist_id uuid;
  v_existing public.tn_words%rowtype;
  v_saved public.tn_words%rowtype;
  v_client_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  v_id := nullif(p_word->>'id','')::uuid;
  if v_id is null then
    raise exception 'Word id is required';
  end if;
  v_playlist_id := nullif(p_word->>'playlist_id','')::uuid;
  if v_playlist_id is not null and not exists (
    select 1 from public.tn_playlists where id = v_playlist_id and user_id = v_user_id
  ) then
    v_playlist_id := null;
  end if;
  v_client_updated_at := coalesce(nullif(p_word->>'content_updated_at','')::timestamptz,now());

  select * into v_existing
  from public.tn_words
  where id = v_id and user_id = v_user_id
  for update;

  if found and v_client_updated_at < v_existing.content_updated_at then
    return jsonb_build_object('applied',false,'reason','stale','word',to_jsonb(v_existing));
  end if;

  if found then
    update public.tn_words set
      playlist_id = v_playlist_id,
      front = coalesce(nullif(btrim(p_word->>'front'),''),v_existing.front),
      back = coalesce(nullif(btrim(p_word->>'back'),''),v_existing.back),
      front_lang = coalesce(nullif(p_word->>'front_lang',''),v_existing.front_lang),
      back_lang = coalesce(nullif(p_word->>'back_lang',''),v_existing.back_lang),
      pos = nullif(btrim(p_word->>'pos'),''),
      gender = nullif(btrim(p_word->>'gender'),''),
      tags = nullif(btrim(p_word->>'tags'),''),
      memo = nullif(btrim(p_word->>'memo'),''),
      pronunciation = nullif(btrim(p_word->>'pronunciation'),''),
      saved = coalesce((p_word->>'saved')::boolean,v_existing.saved),
      position = coalesce(nullif(p_word->>'position','')::integer,v_existing.position),
      content_updated_at = now(),
      updated_at = now()
    where id = v_id and user_id = v_user_id
    returning * into v_saved;
  else
    insert into public.tn_words(
      id,user_id,playlist_id,front,back,front_lang,back_lang,pos,gender,tags,memo,
      pronunciation,saved,position,content_updated_at,updated_at
    ) values (
      v_id,v_user_id,v_playlist_id,
      nullif(btrim(p_word->>'front'),''),nullif(btrim(p_word->>'back'),''),
      coalesce(nullif(p_word->>'front_lang',''),'en-US'),
      coalesce(nullif(p_word->>'back_lang',''),'ja-JP'),
      nullif(btrim(p_word->>'pos'),''),nullif(btrim(p_word->>'gender'),''),
      nullif(btrim(p_word->>'tags'),''),nullif(btrim(p_word->>'memo'),''),
      nullif(btrim(p_word->>'pronunciation'),''),
      coalesce((p_word->>'saved')::boolean,false),
      coalesce(nullif(p_word->>'position','')::integer,0),now(),now()
    ) returning * into v_saved;
  end if;

  return jsonb_build_object('applied',true,'word',to_jsonb(v_saved));
end;
$$;

revoke all on public.tn_playlists, public.tn_words, public.tn_learning_events from anon;
revoke execute on function public.tn_record_learning_result(uuid,text,text,uuid,timestamptz,date) from public, anon;
revoke execute on function public.tn_delete_playlist(uuid) from public, anon;
revoke execute on function public.tn_delete_all_account_data() from public, anon;
revoke execute on function public.tn_import_snapshot(jsonb) from public, anon;
revoke execute on function public.tn_upsert_word_nonlearning(jsonb) from public, anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.tn_playlists to authenticated;
grant select, insert, update, delete on public.tn_words to authenticated;
grant select, insert on public.tn_learning_events to authenticated;
grant execute on function public.tn_record_learning_result(uuid,text,text,uuid,timestamptz,date) to authenticated;
grant execute on function public.tn_delete_playlist(uuid) to authenticated;
grant execute on function public.tn_delete_all_account_data() to authenticated;
grant execute on function public.tn_import_snapshot(jsonb) to authenticated;
grant execute on function public.tn_upsert_word_nonlearning(jsonb) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'tn_playlists'
    ) then
      alter publication supabase_realtime add table public.tn_playlists;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'tn_words'
    ) then
      alter publication supabase_realtime add table public.tn_words;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
