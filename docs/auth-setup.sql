-- ============================================================
-- 회원가입·가구(공동 장부)·초대코드 1단계 서버 설정
-- Supabase → SQL Editor 에 통째로 붙여넣고 Run (경고 창이 뜨면 "Run and enable RLS")
-- 기존 데이터는 지우지 않고, 시작 전에 백업 표를 따로 만들어 둠.
-- ============================================================

-- 0) 백업 (문제 생기면 여기서 되돌림)
create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;
create table if not exists backup.budgets_20261123 as select * from public.budgets;
create table if not exists backup.calendar_notes_20261123 as select * from public.calendar_notes;
create table if not exists backup.inbox_20261123 as select * from public.inbox;

-- 1) 가구와 구성원
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
create table if not exists public.members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile text not null,                 -- 앱 안에서 쓰는 이름 (예: 창진, 효연)
  joined_at timestamptz default now(),
  primary key (household_id, user_id),
  unique (household_id, profile)
);
alter table public.households enable row level security;
alter table public.members enable row level security;

-- 우리 집(기존 데이터) 가구. 두 분은 이 초대코드로 참여
insert into public.households (id, name, invite_code)
values ('3668be2c-55fa-47db-a335-bb35fca478a0', '우리집', 'B7G2P68J')
on conflict (id) do nothing;

-- 내가 속한 가구인지 (정책에서 사용)
create or replace function public.is_member(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where household_id = hid and user_id = auth.uid())
$$;
-- 내 가구 id (새 행 기본값). 로그인 안 한 단축어·시트는 기존 우리집 가구로
create or replace function public.my_household() returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select household_id from public.members where user_id = auth.uid() order by joined_at limit 1),
    '3668be2c-55fa-47db-a335-bb35fca478a0'::uuid)
$$;

drop policy if exists "hh read" on public.households;
create policy "hh read" on public.households for select to authenticated using (public.is_member(id));
drop policy if exists "mem read" on public.members;
create policy "mem read" on public.members for select to authenticated using (public.is_member(household_id));

-- 가구 만들기 / 초대코드로 참여
create or replace function public.create_household(p_name text, p_profile text) returns json
language plpgsql security definer set search_path = '' as $$
declare hid uuid; code text;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.households (name, invite_code, created_by) values (coalesce(nullif(trim(p_name), ''), '우리집'), code, auth.uid())
    returning id into hid;
  insert into public.members (household_id, user_id, profile) values (hid, auth.uid(), trim(p_profile));
  return json_build_object('id', hid, 'invite_code', code);
end $$;

create or replace function public.join_household(p_code text, p_profile text) returns json
language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  select id into hid from public.households where invite_code = upper(trim(p_code));
  if hid is null then raise exception '초대코드를 찾을 수 없어요'; end if;
  if exists (select 1 from public.members where household_id = hid and profile = trim(p_profile) and user_id <> auth.uid()) then
    raise exception '이미 다른 사람이 쓰는 이름이에요';
  end if;
  insert into public.members (household_id, user_id, profile) values (hid, auth.uid(), trim(p_profile))
    on conflict (household_id, user_id) do update set profile = excluded.profile;
  return json_build_object('id', hid);
end $$;

revoke all on function public.create_household(text, text), public.join_household(text, text) from public, anon;
grant execute on function public.create_household(text, text), public.join_household(text, text) to authenticated;

-- 2) 기존 표에 가구 칸 추가 (기존 행은 모두 우리집)
alter table public.budgets add column if not exists household_id uuid;
update public.budgets set household_id = '3668be2c-55fa-47db-a335-bb35fca478a0' where household_id is null;
alter table public.budgets alter column household_id set not null;
alter table public.budgets alter column household_id set default public.my_household();
alter table public.budgets drop constraint if exists budgets_pkey;
alter table public.budgets add primary key (household_id, profile);

alter table public.calendar_notes add column if not exists household_id uuid not null default public.my_household();
alter table public.inbox add column if not exists household_id uuid not null default public.my_household();
alter table public.portfolio_snapshots add column if not exists household_id uuid not null default public.my_household();

-- 3) 권한: 가계부·일정은 로그인한 가구 구성원만. (키만 알면 읽히던 문제 해결)
drop policy if exists "app all" on public.budgets;
drop policy if exists "budgets member" on public.budgets;
create policy "budgets member" on public.budgets for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

drop policy if exists "notes read" on public.calendar_notes;
drop policy if exists "notes insert" on public.calendar_notes;
drop policy if exists "notes update" on public.calendar_notes;
drop policy if exists "notes delete" on public.calendar_notes;
create policy "notes read" on public.calendar_notes for select to authenticated using (public.is_member(household_id));
create policy "notes insert" on public.calendar_notes for insert to authenticated with check (public.is_member(household_id));
create policy "notes update" on public.calendar_notes for update to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "notes delete" on public.calendar_notes for delete to authenticated using (public.is_member(household_id));

-- 문자 수신함: 아이폰 단축어는 지금처럼 넣기만 가능(2단계에서 개인 연결코드로 바꿈), 읽기·처리는 구성원만
drop policy if exists "inbox read" on public.inbox;
drop policy if exists "inbox mark" on public.inbox;
create policy "inbox read" on public.inbox for select to authenticated using (public.is_member(household_id));
create policy "inbox mark" on public.inbox for update to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));

-- 포트폴리오: 구글시트 스크립트는 지금처럼(2단계에서 정리), 앱 읽기는 구성원만 추가
drop policy if exists "pf member read" on public.portfolio_snapshots;
create policy "pf member read" on public.portfolio_snapshots for select to authenticated using (public.is_member(household_id));
