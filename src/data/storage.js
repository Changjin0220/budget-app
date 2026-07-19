// ============================================================
// 저장소 어댑터
// 지금은 localStorage. 추후 클라우드(Firebase/Supabase)로 교체 시
//   이 파일의 loadState/saveState 두 함수 본문만 async 구현으로 바꾸면 됨.
//   (프로필별 네임스페이스 키를 그대로 문서 ID로 사용 가능)
// ============================================================

const NS = 'boobu-gagyebu:v1'

export function profileKey(profile) {
  return `${NS}:${profile}`
}

export function loadState(profile) {
  try {
    const raw = localStorage.getItem(profileKey(profile))
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    console.warn('loadState 실패', e)
    return null
  }
}

export function saveState(profile, state) {
  try {
    localStorage.setItem(profileKey(profile), JSON.stringify(state))
    return true
  } catch (e) {
    console.warn('saveState 실패', e)
    return false
  }
}

const LAST_PROFILE = `${NS}:lastProfile`
export function getLastProfile() {
  try { return localStorage.getItem(LAST_PROFILE) } catch { return null }
}
export function setLastProfile(p) {
  try { localStorage.setItem(LAST_PROFILE, p) } catch { /* noop */ }
}

// 로컬 저장본의 버전 타임스탬프(ms) — 클라우드 동기화 비교용
export function getLocalTs(profile) {
  try { return Number(localStorage.getItem(`${profileKey(profile)}:ts`)) || 0 } catch { return 0 }
}
export function setLocalTs(profile, ts) {
  try { localStorage.setItem(`${profileKey(profile)}:ts`, String(ts)) } catch { /* noop */ }
}

// 백업(내보내기) / 복원(가져오기) — 클라우드 도입 전 기기 간 이동 수단
export function exportProfile(profile) {
  const state = loadState(profile)
  return JSON.stringify({ profile, exportedAt: new Date().toISOString(), state }, null, 2)
}

export function importProfile(profile, jsonText) {
  const parsed = JSON.parse(jsonText)
  const state = parsed.state || parsed
  saveState(profile, state)
  return state
}
