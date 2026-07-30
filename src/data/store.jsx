import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { defaultState, emptyMonthly, defaultAssets, defaultSettings, PROFILES, COMMON_ID } from './defaults'
import {
  loadState, saveState, getLastProfile, setLastProfile, getLocalTs, setLocalTs,
} from './storage'
import {
  loadSyncConfig, saveSyncConfig, cloudEnabled, cloudLoad, cloudSave, cloudTest,
} from './cloud'
import { mergeStates } from './merge'

const Ctx = createContext(null)

// 저장된 상태에 누락 키 보정 (버전 업 시 안전)
export function ensureShape(s) {
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
  if (!out.loans) out.loans = []
  if (!out.assets) out.assets = defaultAssets()
  if (!out.posts) out.posts = []
  return out
}

function loadCommonMerged() {
  const [idA, idB] = PROFILES.map((p) => p.id)
  return mergeStates(ensureShape(loadState(idA)), idA, ensureShape(loadState(idB)), idB)
}

export function AppProvider({ children }) {
  const [profile, setProfileRaw] = useState(() => getLastProfile() || null)
  const [state, setState] = useState(() => {
    if (profile === COMMON_ID) return loadCommonMerged()
    return profile ? ensureShape(loadState(profile)) : null
  })
  const [toast, setToast] = useState(null)
  const isCommon = profile === COMMON_ID

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

  // "공통" 뷰: 두 프로필을 각각 (가능하면 클라우드 최신본으로) 읽어 합침. 저장은 하지 않음(읽기 전용)
  const bootCommon = useCallback(async () => {
    setSyncStatus('idle'); setSyncError('')
    const cfg = cfgRef.current
    const loadOne = async (p) => {
      let s = ensureShape(loadState(p))
      if (cloudEnabled(cfg)) {
        try {
          const remote = await cloudLoad(cfg, p)
          if (remote && remote.updatedAt > (getLocalTs(p) || 0)) {
            s = ensureShape(remote.state)
            saveState(p, s)
            setLocalTs(p, remote.updatedAt)
          }
        } catch { /* 무시: 로컬 값으로 계속 */ }
      }
      return s
    }
    const [idA, idB] = PROFILES.map((p) => p.id)
    const [a, b] = await Promise.all([loadOne(idA), loadOne(idB)])
    setState(mergeStates(a, idA, b, idB))
  }, [])

  const setProfile = useCallback((p) => {
    // 전환 직전 디바운스 대기 중이던 저장이 있으면 유실되지 않도록 즉시 반영
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
      if (profile && profile !== COMMON_ID && state) {
        const ts = dirtyRef.current ? Date.now() : versionRef.current
        saveState(profile, state)
        setLocalTs(profile, ts)
        if (dirtyRef.current && cloudEnabled(cfgRef.current)) {
          cloudSave(cfgRef.current, profile, state, ts).catch(() => {})
        }
        dirtyRef.current = false
      }
    }
    setProfileRaw(p)
    setLastProfile(p)
    if (p === COMMON_ID) { setState(loadCommonMerged()); bootCommon() }
    else if (p) bootProfile(p)
    else setState(null)
  }, [bootProfile, bootCommon, profile, state])

  // 최초 마운트 시 프로필 있으면 클라우드 조회
  useEffect(() => {
    if (profile === COMMON_ID) bootCommon()
    else if (profile) bootProfile(profile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 주기적으로 공통 뷰 새로고침 (배우자 쪽 변경 반영) + 창 포커스 시
  useEffect(() => {
    if (!isCommon) return
    let alive = true
    const iv = setInterval(() => { if (alive) bootCommon() }, 25000)
    const onFocus = () => bootCommon()
    window.addEventListener('focus', onFocus)
    return () => { alive = false; clearInterval(iv); window.removeEventListener('focus', onFocus) }
  }, [isCommon, bootCommon])

  // 상태 변경 → 디바운스 저장(로컬 즉시 캐시 + 클라우드 push). 공통 뷰는 저장 대상이 아니므로 건너뜀
  useEffect(() => {
    if (!profile || !state || isCommon) return
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
    if (!profile || isCommon || !cloudEnabled(syncConfig)) return
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

  // 상태 변경 헬퍼: draft를 직접 수정 (로컬 변경으로 표시). 공통 뷰는 읽기 전용이라 막음
  const mutate = useCallback((fn) => {
    if (isCommon) {
      showToast('공통 보기는 읽기 전용이에요. 입력하려면 창진 또는 효연으로 전환해주세요.')
      return
    }
    dirtyRef.current = true
    setState((prev) => {
      const draft = structuredClone(prev)
      fn(draft)
      return draft
    })
  }, [isCommon, showToast])

  const replaceState = useCallback((next) => {
    if (isCommon) return
    dirtyRef.current = true
    setState(ensureShape(next))
  }, [isCommon])

  // ----- 동기화 설정 API (Settings에서 사용) -----
  const updateSyncConfig = useCallback((cfg) => {
    setSyncConfigState(cfg); saveSyncConfig(cfg); cfgRef.current = cfg
  }, [])
  const testConnection = useCallback(async (cfg) => {
    await cloudTest(cfg || cfgRef.current); return true
  }, [])
  const manualSync = useCallback(async () => {
    if (!profile) return
    if (isCommon) { await bootCommon(); showToast('공통 보기를 새로고침했어요'); return }
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
  }, [profile, state, applyRemote, isCommon, bootCommon, showToast])

  const value = useMemo(() => ({
    profile, isCommon, setProfile, state, mutate, showToast, replaceState,
    syncConfig, updateSyncConfig, syncStatus, syncError, testConnection, manualSync,
  }), [profile, isCommon, state, mutate, setProfile, showToast, replaceState,
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
