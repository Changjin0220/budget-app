import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { defaultState, emptyMonthly, defaultAssets, defaultSettings } from './defaults'
import {
  loadState, saveState, getLastProfile, setLastProfile, getLocalTs, setLocalTs,
} from './storage'
import {
  loadSyncConfig, saveSyncConfig, cloudEnabled, cloudLoad, cloudSave, cloudTest,
} from './cloud'

const Ctx = createContext(null)

// 저장된 상태에 누락 키 보정 (버전 업 시 안전)
function ensureShape(s) {
  const base = defaultState()
  const out = { ...base, ...(s || {}) }
  out.settings = { ...defaultSettings(out.settings?.year || 2026), ...(s?.settings || {}) }
  if (!out.monthly) out.monthly = emptyMonthly()
  for (let i = 1; i <= 12; i++) {
    if (!out.monthly[i]) out.monthly[i] = { rows: [], budgets: {}, targets: {}, checklist: [] }
    else out.monthly[i] = { rows: [], budgets: {}, targets: {}, checklist: [], ...out.monthly[i] }
  }
  if (!out.fixed) out.fixed = []
  if (!out.installments) out.installments = []
  if (!out.assets) out.assets = defaultAssets()
  return out
}

export function AppProvider({ children }) {
  const [profile, setProfileRaw] = useState(() => getLastProfile() || null)
  const [state, setState] = useState(() => (profile ? ensureShape(loadState(profile)) : null))
  const [toast, setToast] = useState(null)

  // ----- 클라우드 동기화 상태 -----
  const [syncConfig, setSyncConfigState] = useState(() => loadSyncConfig())
  const [syncStatus, setSyncStatus] = useState('idle') // idle|syncing|synced|error|offline
  const [syncError, setSyncError] = useState('')

  const saveTimer = useRef(null)
  const versionRef = useRef(profile ? (getLocalTs(profile) || 0) : 0) // 현재 보유 버전(ms)
  const dirtyRef = useRef(false)      // 로컬 변경(=클라우드 push 필요) 여부
  const cfgRef = useRef(syncConfig)
  useEffect(() => { cfgRef.current = syncConfig }, [syncConfig])

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1900)
  }, [])

  // 원격 상태 적용 (push 유발 안 함)
  const applyRemote = useCallback((remoteState, remoteTs, prof) => {
    versionRef.current = remoteTs
    dirtyRef.current = false
    const shaped = ensureShape(remoteState)
    setState(shaped)
    saveState(prof, shaped)
    setLocalTs(prof, remoteTs)
  }, [])

  // 초기/전환 로드 + 클라우드 조회
  const bootProfile = useCallback(async (p) => {
    const localTs = getLocalTs(p) || 0
    versionRef.current = localTs
    dirtyRef.current = false
    setState(ensureShape(loadState(p)))

    const cfg = cfgRef.current
    if (!cloudEnabled(cfg)) { setSyncStatus('idle'); return }
    setSyncStatus('syncing'); setSyncError('')
    try {
      const remote = await cloudLoad(cfg, p)
      if (remote && remote.updatedAt > versionRef.current) {
        applyRemote(remote.state, remote.updatedAt, p)
      } else if (!remote) {
        // 클라우드에 아직 없으면 로컬 데이터를 올림
        const ts = localTs || Date.now()
        await cloudSave(cfg, p, ensureShape(loadState(p)), ts)
        versionRef.current = ts
        setLocalTs(p, ts)
      }
      setSyncStatus('synced')
    } catch (e) {
      setSyncStatus('error'); setSyncError(String(e.message || e))
    }
  }, [applyRemote])

  const setProfile = useCallback((p) => {
    setProfileRaw(p)
    setLastProfile(p)
    if (p) bootProfile(p)
    else setState(null)
  }, [bootProfile])

  // 최초 마운트 시 프로필 있으면 클라우드 조회
  useEffect(() => {
    if (profile) bootProfile(profile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 상태 변경 → 디바운스 저장(로컬 즉시 캐시 + 클라우드 push)
  useEffect(() => {
    if (!profile || !state) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const ts = dirtyRef.current ? Date.now() : versionRef.current
      if (dirtyRef.current) versionRef.current = ts
      saveState(profile, state)
      setLocalTs(profile, versionRef.current)

      const cfg = cfgRef.current
      if (dirtyRef.current && cloudEnabled(cfg)) {
        setSyncStatus('syncing')
        try {
          await cloudSave(cfg, profile, state, ts)
          dirtyRef.current = false
          setSyncStatus('synced')
        } catch (e) {
          setSyncStatus('error'); setSyncError(String(e.message || e))
        }
      } else {
        dirtyRef.current = false
      }
    }, 350)
    return () => saveTimer.current && clearTimeout(saveTimer.current)
  }, [profile, state])

  // 주기적 pull + 창 포커스 시 pull (배우자 변경 반영)
  useEffect(() => {
    if (!profile || !cloudEnabled(syncConfig)) return
    let alive = true
    const pull = async () => {
      if (dirtyRef.current) return // 내 미저장 변경 중엔 건너뜀
      try {
        const remote = await cloudLoad(cfgRef.current, profile)
        if (alive && remote && remote.updatedAt > versionRef.current) {
          applyRemote(remote.state, remote.updatedAt, profile)
          setSyncStatus('synced')
        }
      } catch { /* 무시 (다음 주기 재시도) */ }
    }
    const iv = setInterval(pull, 25000)
    const onFocus = () => pull()
    window.addEventListener('focus', onFocus)
    return () => { alive = false; clearInterval(iv); window.removeEventListener('focus', onFocus) }
  }, [profile, syncConfig, applyRemote])

  // 상태 변경 헬퍼: draft를 직접 수정 (로컬 변경으로 표시)
  const mutate = useCallback((fn) => {
    dirtyRef.current = true
    setState((prev) => {
      const draft = structuredClone(prev)
      fn(draft)
      return draft
    })
  }, [])

  const replaceState = useCallback((next) => {
    dirtyRef.current = true
    setState(ensureShape(next))
  }, [])

  // ----- 동기화 설정 API (Settings에서 사용) -----
  const updateSyncConfig = useCallback((cfg) => {
    setSyncConfigState(cfg); saveSyncConfig(cfg); cfgRef.current = cfg
  }, [])
  const testConnection = useCallback(async (cfg) => {
    await cloudTest(cfg || cfgRef.current); return true
  }, [])
  const manualSync = useCallback(async () => {
    if (!profile) return
    const cfg = cfgRef.current
    if (!cloudEnabled(cfg)) return
    setSyncStatus('syncing'); setSyncError('')
    try {
      const remote = await cloudLoad(cfg, profile)
      if (remote && remote.updatedAt > versionRef.current) {
        applyRemote(remote.state, remote.updatedAt, profile)
      } else {
        const ts = Date.now()
        versionRef.current = ts; setLocalTs(profile, ts)
        await cloudSave(cfg, profile, state, ts)
        dirtyRef.current = false
      }
      setSyncStatus('synced')
    } catch (e) { setSyncStatus('error'); setSyncError(String(e.message || e)) }
  }, [profile, state, applyRemote])

  const value = useMemo(() => ({
    profile, setProfile, state, mutate, showToast, replaceState,
    syncConfig, updateSyncConfig, syncStatus, syncError, testConnection, manualSync,
  }), [profile, state, mutate, setProfile, showToast, replaceState,
    syncConfig, updateSyncConfig, syncStatus, syncError, testConnection, manualSync])

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && <div className="toast">{toast}</div>}
    </Ctx.Provider>
  )
}

export function useApp() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApp must be used within AppProvider')
  return c
}
