// ============================================================
// 로그인(Supabase Auth)과 공통 요청 헤더
// URL과 anon key는 공개용 값이라 앱에 넣어도 됨. 실제 접근 제어는 서버의 RLS가 함:
// 로그인한 사람의 토큰으로 요청해야 자기 가구 데이터만 보임.
// ============================================================
import { createClient } from '@supabase/supabase-js'

export const SUPA_URL = 'https://heoplfkxrvmzvoiqgtnd.supabase.co'
export const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhlb3BsZmt4cnZtenZvaXFndG5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzUyNjMsImV4cCI6MjA5OTQ1MTI2M30.NPIdA5hIZqwRkD5YfNemoG5_3wkNBaNUK-X29OBOKR4'

export const supabase = createClient(SUPA_URL, SUPA_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'boobu-gagyebu:auth' },
})

// fetch로 직접 부르는 곳(cloud.js 등)에서 쓰는 헤더. 로그인 토큰이 있으면 그걸로.
export async function authHeaders(cfg) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return { apikey: cfg.key, Authorization: `Bearer ${token || cfg.key}` }
}

// 내가 속한 가구 목록
export async function myMemberships(userId) {
  const { data, error } = await supabase
    .from('members')
    .select('household_id, profile, households(name, invite_code)')
    .eq('user_id', userId)
    .order('joined_at')
  if (error) throw error
  return data || []
}

export async function householdMembers(hid) {
  const { data, error } = await supabase.from('members').select('profile, user_id').eq('household_id', hid).order('joined_at')
  if (error) throw error
  return data || []
}

export async function createHousehold(name, profile) {
  const { data, error } = await supabase.rpc('create_household', { p_name: name, p_profile: profile })
  if (error) throw error
  return data
}

export async function joinHousehold(code, profile) {
  const { data, error } = await supabase.rpc('join_household', { p_code: code, p_profile: profile })
  if (error) throw error
  return data
}

// 로그아웃 시 이 기기에 남은 가계부 사본도 지움 (다른 사람이 같은 기기로 로그인할 수 있으니)
export async function signOutAndClear() {
  await supabase.auth.signOut()
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('boobu-gagyebu:')) localStorage.removeItem(k)
  } catch { /* noop */ }
}
