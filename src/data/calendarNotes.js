// ============================================================
// 공유 일정 메모 (Supabase REST, calendar_notes 테이블)
// 프로필 문서(budgets)와 따로 두는 이유: 두 사람이 동시에 메모를 써도
// 문서 통째 덮어쓰기(last-write-wins)로 서로의 메모가 사라지지 않게 하려고.
// ============================================================

function base(cfg) { return cfg.url.replace(/\/+$/, '') }

async function req(cfg, path, opts = {}) {
  const res = await fetch(`${base(cfg)}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`notes ${res.status}: ${txt.slice(0, 120)}`)
  }
  return res
}

// from, to: 'YYYY-MM-DD' (포함)
export async function notesFetch(cfg, from, to) {
  const res = await req(cfg,
    `calendar_notes?date=gte.${from}&date=lte.${to}&select=*&order=at_time.asc.nullsfirst,created_at.asc&limit=1000`)
  return res.json()
}

// atTime: 'HH:MM' 또는 '', notifyTo: ['창진','효연'], remindAt: timestamptz 문자열 배열
export async function notesAdd(cfg, { date, text, author, atTime = '', notifyTo = [], remindAt = [] }) {
  const body = { date, text, author }
  if (atTime) body.at_time = atTime
  if (notifyTo.length) { body.notify_to = notifyTo; body.remind_at = remindAt }
  const res = await req(cfg, 'calendar_notes', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  const [row] = await res.json()
  return row
}

// 알림 대상·시각만 수정 (서버에서 이 두 칸만 수정 허용)
export async function notesUpdate(cfg, id, { notify_to, remind_at }) {
  const res = await req(cfg, `calendar_notes?id=eq.${Number(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ notify_to, remind_at }),
  })
  const [row] = await res.json()
  return row
}

export async function notesDelete(cfg, id) {
  await req(cfg, `calendar_notes?id=eq.${Number(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
}

export const NOTES_SQL = `create table calendar_notes (
  id bigint generated always as identity primary key,
  date date not null,             -- 일정 날짜
  text text not null,             -- 메모 내용
  author text not null,           -- '창진' / '효연'
  created_at timestamptz default now()
);
create index calendar_notes_date_idx on calendar_notes (date);
alter table calendar_notes enable row level security;
create policy "notes read" on calendar_notes for select using (true);
create policy "notes insert" on calendar_notes for insert with check (true);
create policy "notes delete" on calendar_notes for delete using (true);`
