import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { defaultState, emptyMonthly, defaultAssets, defaultSettings, PROFILES, COMMON_ID } from './defaults'
import {
  loadState, saveState, getLastProfile, setLastProfile, getLocalTs, setLocalTs,
} from './storage'
import {
  loadSyncConfig, saveSyncConfig, cloudEnabled, cloudLoad, cloudSave, cloudTest,
} from './cloud'
import { mergeStates, syncCategoryLists } from './merge'

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

function catFingerprint(s) {
  return JSON.stringify({ income: s.income, saving: s.saving, expense: s.expense, payments: s.payments })
}

// 배우자 프로필과 카테고리/결제수단을 합쳐서(누락분만 서로 채움) 상대쪽 저장(+가능하면 클라우드 push)까지 처리하고, 합쳐진 결과를 반환
function syncCategoriesWithSpouse(profileId, mySettings, cloudCfg) {
  const other = PROFILES.find((p) => p.id !== profileId)
  if (!other) return mySettings
  const otherState = ensureShape(loadState(other.id))
  const merged = syncCategoryLists(mySettings, otherState.settings)
  if (catFingerprint(merged) !== catFingerprint(otherState.settings)) {
    otherState.settings.income = merged.income
    otherState.settings.saving = merged.saving
    otherState.settings.expense = merged.expense
    otherState.settings.payments = merged.payments
    saveState(other.id, otherState)
    if (cloudEnabled(cloudCfg)) {
      cloudSave(cloudCfg, other.id, otherState, Date.now()).catch(() => {})
    }
  }
  return merged
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

    // 로그인할 때마다 배우자 프로필과 카테고리/결제수단 차이를 자동으로 한 번 맞춰줌(그동안 쌓인 차이 포함)
    const mine = ensureShape(loadState(p))
    const merged = syncCategoriesWithSpouse(p, mine.settings, cfgRef.current)
    if (catFingerprint(merged) !== catFingerprint(mine.settings)) {
      mine.settings.income = merged.income
      mine.settings.saving = merged.saving
      mine.settings.expense = merged.expense
      mine.settings.payments = merged.payments
      saveState(p, mine)
    }
    lastSyncedCatsRef.current = catFingerprint(mine.settings)
    setState(mine)

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

  // 대분류/소분류/결제수단이 바뀌면 잠시(편집이 잦아들 때까지) 기다렸다가 배우자 프로필에도 자동으로 맞춰서 저장.
  // 디바운스하는 이유: "+ 소분류" 클릭(임시 이름 "새 항목") 직후 바로 이름을 입력하는 흐름이 각각 별도 변경으로 잡히는데,
  // 즉시 동기화하면 임시 이름이 배우자 쪽에 먼저 저장되어 나중에 실제 이름과 함께 중복으로 남는 문제가 있었음.
  const lastSyncedCatsRef = useRef(null)
  const catSyncTimer = useRef(null)
  // 프로필이 바뀌면(전환) 이전 프로필 기준값을 들고 있지 않도록 초기화
  useEffect(() => { lastSyncedCatsRef.current = null }, [profile])
  useEffect(() => {
    if (!profile || isCommon || !state) return
    const fp = catFingerprint(state.settings)
    if (lastSyncedCatsRef.current === null) { lastSyncedCatsRef.current = fp; return }
    if (fp === lastSyncedCatsRef.current) return
    if (catSyncTimer.current) clearTimeout(catSyncTimer.current)
    catSyncTimer.current = setTimeout(() => {
      const merged = syncCategoriesWithSpouse(profile, state.settings, cfgRef.current)
      lastSyncedCatsRef.current = catFingerprint(merged)

      if (catFingerprint(merged) !== fp) {
        setState((prev) => {
          const draft = structuredClone(prev)
          draft.settings.income = merged.income
          draft.settings.saving = merged.saving
          draft.settings.expense = merged.expense
          draft.settings.payments = merged.payments
          return draft
        })
        dirtyRef.current = true
      }
    }, 900)
    return () => catSyncTimer.current && clearTimeout(catSyncTimer.current)
  }, [profile, isCommon, state])

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
