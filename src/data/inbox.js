// ============================================================
// 자동 수집 inbox (Supabase REST)
// 아이폰 단축어가 카드 승인 문자를 inbox 테이블에 넣고,
// 앱은 여기서 status='new' 인 것을 읽어 사용자가 확인 후 월간내역에 반영.
// 문자를 budgets(프로필 문서)에 직접 쓰지 않는 이유: budgets는 문서 통째 last-write-wins라
// 폰과 앱이 동시에 쓰면 내역이 덮어써질 수 있음.
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
    throw new Error(`inbox ${res.status}: ${txt.slice(0, 120)}`)
  }
  return res
}

// 새로 들어온 문자 목록 (오래된 순)
export async function inboxFetch(cfg, profile) {
  const res = await req(cfg,
    `inbox?profile=eq.${encodeURIComponent(profile)}&status=eq.new&select=id,body,received_at&order=received_at.asc&limit=200`)
  return res.json()
}

// 처리 상태 변경: 'done'(반영) | 'skip'(무시)
export async function inboxMark(cfg, ids, status) {
  if (!ids.length) return
  await req(cfg, `inbox?id=in.(${ids.map(Number).join(',')})`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status }),
  })
}

export const INBOX_SQL = `create table inbox (
  id bigint generated always as identity primary key,
  profile text not null,          -- '창진' 또는 '효연'
  body text not null,             -- 문자 원문
  received_at timestamptz default now(),
  status text default 'new'       -- new | done | skip
);
alter table inbox enable row level security;
create policy "inbox insert" on inbox for insert with check (true);
create policy "inbox read" on inbox for select using (true);
create policy "inbox mark" on inbox for update using (true) with check (true);
-- delete 정책은 만들지 않음: 앱·단축어 모두 문자를 지울 수 없음`
