-- ============================================================
-- 가계부마다 "같이 쓰는 사람 이름" 목록 (만든 사람이 정하고, 나중에 추가 가능)
-- 초대코드로 들어오는 사람은 코드 확인 뒤 남은 이름 중에서 고름
-- Supabase → SQL Editor 에 통째로 붙여넣고 Run
-- ============================================================

create table if not exists public.ledger_slots (
  household_id uuid not null references public.ledger_households(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  primary key (household_id, name)
);
alter table public.ledger_slots enable row level security;
drop policy if exists "slots read" on public.ledger_slots;
create policy "slots read" on public.ledger_slots for select to authenticated using (public.is_member(household_id));

-- 우리집: 창진, 효연
insert into public.ledger_slots (household_id, name, sort) values
  ('3668be2c-55fa-47db-a335-bb35fca478a0', '창진', 0),
  ('3668be2c-55fa-47db-a335-bb35fca478a0', '효연', 1)
on conflict do nothing;

-- 새 가계부 만들기: 이름 목록 + 그중 내 이름
drop function if exists public.create_household(text, text);
create or replace function public.create_household(p_name text, p_names text[], p_my text) returns json
language plpgsql security definer set search_path = '' as $$
declare hid uuid; code text; i int := 0; n text;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  if p_names is null or cardinality(p_names) = 0 then raise exception '이름을 한 개 이상 넣어 주세요'; end if;
  if not (trim(p_my) = any(select trim(x) from unnest(p_names) x)) then raise exception '내 이름을 목록에서 골라 주세요'; end if;
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.ledger_households (name, invite_code, created_by)
    values (coalesce(nullif(trim(p_name), ''), '우리집'), code, auth.uid()) returning id into hid;
  foreach n in array p_names loop
    if nullif(trim(n), '') is not null then
      insert into public.ledger_slots (household_id, name, sort) values (hid, trim(n), i) on conflict do nothing;
      i := i + 1;
    end if;
  end loop;
  insert into public.ledger_members (household_id, user_id, profile) values (hid, auth.uid(), trim(p_my));
  return json_build_object('id', hid, 'invite_code', code);
end $$;

-- 초대코드 확인: 가계부 이름과 이름 목록(이미 누가 쓰는지)만 보여줌
create or replace function public.peek_household(p_code text) returns json
language plpgsql stable security definer set search_path = '' as $$
declare h record;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  select id, name into h from public.ledger_households where invite_code = upper(trim(p_code));
  if h.id is null then raise exception '초대코드를 찾을 수 없어요'; end if;
  return json_build_object('name', h.name, 'slots', (
    select coalesce(json_agg(json_build_object('name', s.name,
      'taken', exists (select 1 from public.ledger_members m where m.household_id = h.id and m.profile = s.name and m.user_id <> auth.uid()))
      order by s.sort), '[]'::json)
    from public.ledger_slots s where s.household_id = h.id));
end $$;

-- 초대코드로 참여: 목록에 있고 아직 아무도 안 쓰는 이름만
create or replace function public.join_household(p_code text, p_profile text) returns json
language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  select id into hid from public.ledger_households where invite_code = upper(trim(p_code));
  if hid is null then raise exception '초대코드를 찾을 수 없어요'; end if;
  if not exists (select 1 from public.ledger_slots where household_id = hid and name = trim(p_profile)) then
    raise exception '목록에 없는 이름이에요';
  end if;
  if exists (select 1 from public.ledger_members where household_id = hid and profile = trim(p_profile) and user_id <> auth.uid()) then
    raise exception '이미 다른 사람이 쓰는 이름이에요';
  end if;
  insert into public.ledger_members (household_id, user_id, profile) values (hid, auth.uid(), trim(p_profile))
    on conflict (household_id, user_id) do update set profile = excluded.profile;
  return json_build_object('id', hid);
end $$;

-- 나중에 같이 쓸 사람 추가
create or replace function public.add_slot(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  hid := (select household_id from public.ledger_members where user_id = auth.uid() order by joined_at limit 1);
  if hid is null then raise exception '가계부에 먼저 참여해 주세요'; end if;
  if nullif(trim(p_name), '') is null or trim(p_name) = '공통' then raise exception '쓸 수 없는 이름이에요'; end if;
  insert into public.ledger_slots (household_id, name, sort)
    values (hid, trim(p_name), coalesce((select max(sort) + 1 from public.ledger_slots where household_id = hid), 0))
    on conflict do nothing;
end $$;

revoke all on function public.create_household(text, text[], text), public.peek_household(text),
  public.join_household(text, text), public.add_slot(text) from public, anon;
grant execute on function public.create_household(text, text[], text), public.peek_household(text),
  public.join_household(text, text), public.add_slot(text) to authenticated;
