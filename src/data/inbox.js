// ============================================================
// 자동 수집 inbox (Supabase REST)
// 아이폰 단축어가 카드 승인 문자를 inbox 테이블에 넣고,
// 앱은 여기서 status='new' 인 것을 읽어 사용자가 확인 후 월간내역에 반영.
// 문자를 budgets(프로필 문서)에 직접 쓰지 않는 이유: budgets는 문서 통째 last-write-wins라
// 폰과 앱이 동시에 쓰면 내역이 덮어써질 수 있음.
// ============================================================

import { authHeaders } from './auth'

function base(cfg) { return cfg.url.replace(/\/+$/, '') }

async function req(cfg, path, opts = {}) {
  const res = await fetch(`${base(cfg)}/rest/v1/${path}`, {
    ...opts,
    headers: {
      ...(await authHeaders(cfg)),
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

// 문자 목록을 월간내역 행으로 추가 (mutate 안에서 호출). 이미 같은 문자로 만든 행이 있으면 건너뜀.
// list: [{ id, parsed, major, minor, payment }]
export function pushInboxRows(d, list, makeId) {
  const seen = new Set()
  for (let mo = 1; mo <= 12; mo++) for (const r of d.monthly[mo]?.rows || []) if (r.source) seen.add(r.source)
  let added = 0
  for (const x of list) {
    const p = x.parsed
    const source = `sms:${x.id}`
    if (!p?.ok || seen.has(source) || !d.monthly[p.month]) continue
    if (x.payment && !d.settings.payments.includes(x.payment)) d.settings.payments.push(x.payment)
    const memo = [p.cancel ? '승인취소' : '', p.installment ? `${p.installment}개월 할부` : '', x.auto ? '문자자동반영' : '문자자동']
      .filter(Boolean).join(' · ')
    d.monthly[p.month].rows.push({
      id: makeId(), day: p.day, kind: 'expense',
      major: x.major, minor: x.minor,
      amount: p.cancel ? -p.amount : p.amount,
      payment: x.payment, detail: p.merchant, memo, source,
    })
    seen.add(source); added++
  }
  return added
}

// 승인취소 문자 짝 찾기.
// 1) 아직 수신함에 있는 같은 가맹점·같은 금액의 승인 문자 → 둘 다 처리(내역에 안 넣음)
// 2) 이미 월간내역에 들어간 같은 가맹점·같은 금액 지출 중 취소일 이전 가장 최근 것 → 그 행 삭제
// 못 찾으면 수신함에 남김. items: [{ id, received_at, parsed }]
export function matchCancels(state, items, normMerchant) {
  const key = (p) => normMerchant(p.merchant)
  const when = (p) => p.month * 100 + p.day
  const usedPending = new Set()
  const usedRows = new Set()
  const pairs = []     // { cancelId, pendingId }
  const removals = []  // { cancelId, rowId, month }
  const cancels = items.filter((x) => x.parsed.ok && x.parsed.cancel)
    .sort((a, b) => String(a.received_at).localeCompare(String(b.received_at)))
  for (const c of cancels) {
    const p = c.parsed
    const pend = items
      .filter((x) => x.parsed.ok && !x.parsed.cancel && !usedPending.has(x.id)
        && x.parsed.amount === p.amount && key(x.parsed) === key(p)
        && String(x.received_at) <= String(c.received_at))
      .sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)))[0]
    if (pend) { usedPending.add(pend.id); pairs.push({ cancelId: c.id, pendingId: pend.id }); continue }
    let best = null
    for (let mo = 1; mo <= 12; mo++) {
      ;(state.monthly[mo]?.rows || []).forEach((r, i) => {
        if (usedRows.has(r.id) || r.kind !== 'expense' || Number(r.amount) !== p.amount) return
        if (normMerchant(r.detail) !== key(p)) return
        const w = mo * 100 + (Number(r.day) || 0)
        if (w > when(p)) return
        if (!best || w > best.w || (w === best.w && i > best.i)) best = { w, i, rowId: r.id, month: mo }
      })
    }
    if (best) { usedRows.add(best.rowId); removals.push({ cancelId: c.id, rowId: best.rowId, month: best.month }) }
  }
  return { pairs, removals }
}
