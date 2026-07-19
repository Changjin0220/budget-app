// ============================================================
// 클라우드 동기화 어댑터 (Supabase REST)
// - 별도 SDK 없이 fetch로 동작 (번들 가벼움)
// - 설정에서 URL / anon key 를 입력하면 활성화
// - 없으면 자동으로 로컬(localStorage)만 사용 → 절대 앱이 깨지지 않음
//
// [Supabase 준비 - 최초 1회, 무료]
//   1) supabase.com 에서 프로젝트 생성 (부부가 '하나의' 프로젝트를 공유)
//   2) SQL Editor 에서 아래 실행:
//        create table budgets (
//          profile text primary key,
//          data jsonb,
//          updated_at timestamptz default now()
//        );
//        alter table budgets enable row level security;
//        create policy "app all" on budgets for all using (true) with check (true);
//   3) Project Settings → API 에서 Project URL 과 anon public key 복사
//   4) 앱 → 설정 → 클라우드 동기화 에 붙여넣고 '켜기'
//      (두 기기/두 사람이 같은 URL·key 를 넣으면 서로 동기화됨)
// ============================================================

const CFG_KEY = 'boobu-gagyebu:v1:syncConfig'

export function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(CFG_KEY)
    return raw ? JSON.parse(raw) : { enabled: false, url: '', key: '' }
  } catch { return { enabled: false, url: '', key: '' } }
}

export function saveSyncConfig(cfg) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)) } catch { /* noop */ }
}

export function cloudEnabled(cfg) {
  return !!(cfg && cfg.enabled && cfg.url && cfg.key)
}

function base(cfg) {
  return cfg.url.replace(/\/+$/, '')
}

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
    throw new Error(`Supabase ${res.status}: ${txt.slice(0, 120)}`)
  }
  return res
}

// 특정 프로필 문서 로드 → { state, updatedAt(ms) } | null
export async function cloudLoad(cfg, profile) {
  const res = await req(cfg, `budgets?profile=eq.${encodeURIComponent(profile)}&select=data,updated_at`)
  const rows = await res.json()
  if (!rows.length) return null
  return { state: rows[0].data, updatedAt: Date.parse(rows[0].updated_at) || 0 }
}

// 저장(업서트). updatedAt(ms) 전달 → 서버 열에 기록
export async function cloudSave(cfg, profile, state, updatedAtMs) {
  const body = [{
    profile,
    data: state,
    updated_at: new Date(updatedAtMs || Date.now()).toISOString(),
  }]
  await req(cfg, 'budgets?on_conflict=profile', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(body),
  })
}

// 연결 테스트: 테이블 접근 가능 여부 확인
export async function cloudTest(cfg) {
  await req(cfg, 'budgets?select=profile&limit=1')
  return true
}
