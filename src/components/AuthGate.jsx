import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase, myMemberships, householdSlots, createHousehold, peekHousehold, joinHousehold } from '../data/auth'
import { setLastProfile } from '../data/storage'
import { setProfiles, COMMON_ID } from '../data/defaults'
import './profileGate.css'

// 로그인 → 가구 참여까지 끝나야 가계부가 열림
const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

const friendly = (e) => {
  const m = String(e?.message || e)
  if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않아요'
  if (/already registered/i.test(m)) return '이미 가입된 이메일이에요. 로그인해 주세요'
  if (/Password should be/i.test(m)) return '비밀번호는 6자 이상이어야 해요'
  if (/Email not confirmed/i.test(m)) return '메일함에서 가입 확인 링크를 먼저 눌러 주세요'
  if (/rate limit/i.test(m)) return '잠시 후 다시 시도해 주세요'
  return m
}

function Shell({ children }) {
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-mark">₩</div>
        <h1>우리집 가계부</h1>
        <p className="gate-sub">함께 쓰고 함께 모으는 가계부</p>
        {children}
      </div>
    </div>
  )
}

function Login() {
  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg('')
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pw, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        if (!data.session) setMsg('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
        if (error) throw error
      }
    } catch (err) { setMsg(friendly(err)) }
    finally { setBusy(false) }
  }

  return (
    <Shell>
      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setMsg('') }}>로그인</button>
        <button className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setMsg('') }}>회원가입</button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <input className="input" type="email" autoComplete="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          placeholder="비밀번호 (6자 이상)" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} />
        <button className="btn primary" disabled={busy}>{busy ? '잠시만요…' : mode === 'login' ? '로그인' : '가입하기'}</button>
      </form>
      {msg && <div className="auth-msg">{msg}</div>}
      <div className="gate-foot">로그인하면 내 가구 사람만 가계부를 볼 수 있어요</div>
    </Shell>
  )
}

function JoinForm({ onDone }) {
  const [code, setCode] = useState('')
  const [peek, setPeek] = useState(null) // { name, slots: [{name, taken}] }
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const check = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg('')
    try {
      const p = await peekHousehold(code)
      setPeek(p); setPick(p.slots.find((x) => !x.taken)?.name || '')
      if (!p.slots.some((x) => !x.taken)) setMsg('남은 이름이 없어요. 가계부 주인에게 설정에서 이름을 추가해 달라고 해 주세요.')
    } catch (err) { setMsg(friendly(err)) }
    finally { setBusy(false) }
  }
  const join = async () => {
    setBusy(true); setMsg('')
    try { await joinHousehold(code, pick); setLastProfile(pick); onDone() }
    catch (err) { setMsg(friendly(err)) }
    finally { setBusy(false) }
  }

  return (
    <>
      {!peek ? (
        <form className="auth-form" onSubmit={check}>
          <input className="input" placeholder="초대코드 8자리" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
            required maxLength={8} style={{ letterSpacing: 2, textAlign: 'center' }} />
          <button className="btn primary" disabled={busy || code.trim().length < 8}>{busy ? '확인 중…' : '코드 확인'}</button>
        </form>
      ) : (
        <div className="auth-form">
          <div className="gate-who" style={{ margin: 0 }}>“{peek.name}” 가계부예요. 나는 누구인가요?</div>
          <div className="name-pick">
            {peek.slots.map((x) => (
              <button type="button" key={x.name} disabled={x.taken} className={`chip-pick ${pick === x.name ? 'on' : ''}`} onClick={() => setPick(x.name)}>
                {x.name}{x.taken && <span> · 사용 중</span>}
              </button>
            ))}
          </div>
          <button className="btn primary" disabled={busy || !pick} onClick={join}>{busy ? '잠시만요…' : `${pick || '이름'}(으)로 참여하기`}</button>
          <button type="button" className="btn ghost sm" onClick={() => { setPeek(null); setMsg('') }}>코드 다시 입력</button>
        </div>
      )}
      {msg && <div className="auth-msg">{msg}</div>}
    </>
  )
}

function CreateForm({ onDone }) {
  const [name, setName] = useState('')
  const [names, setNames] = useState(['', ''])
  const [me, setMe] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const setAt = (i, v) => setNames((xs) => xs.map((x, j) => (j === i ? v : x)))
  const remove = (i) => { setNames((xs) => xs.filter((_, j) => j !== i)); setMe((m) => (m === i ? 0 : m > i ? m - 1 : m)) }

  const submit = async (e) => {
    e.preventDefault()
    const clean = names.map((x) => x.trim())
    if (clean.some((x) => !x)) { setMsg('이름 칸을 모두 채우거나 빈 칸은 지워 주세요'); return }
    if (new Set(clean).size !== clean.length) { setMsg('같은 이름이 두 번 있어요'); return }
    if (clean.includes(COMMON_ID)) { setMsg(`"${COMMON_ID}"은(는) 합산 보기 이름이라 쓸 수 없어요`); return }
    setBusy(true); setMsg('')
    try { await createHousehold(name || '우리집', clean, clean[me]); setLastProfile(clean[me]); onDone() }
    catch (err) { setMsg(friendly(err)) }
    finally { setBusy(false) }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <input className="input" placeholder="가계부 이름 (예: 우리집)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="helper" style={{ textAlign: 'left' }}>함께 쓸 사람 {names.length}명 · 이름을 정하고 나를 골라 주세요 (나중에 설정에서 추가 가능)</div>
      {names.map((n, i) => (
        <div key={i} className="name-row">
          <button type="button" className={`me-dot ${me === i ? 'on' : ''}`} onClick={() => setMe(i)} title="나">{me === i ? '나' : ''}</button>
          <input className="input" placeholder={i === 0 ? '예: 창진' : '예: 효연'} value={n} onChange={(e) => setAt(i, e.target.value)} maxLength={10} />
          {names.length > 1 && <button type="button" className="btn ghost sm" onClick={() => remove(i)} aria-label="삭제">✕</button>}
        </div>
      ))}
      {names.length < 8 && <button type="button" className="btn sm" onClick={() => setNames((xs) => [...xs, ''])}>+ 사람 추가</button>}
      <button className="btn primary" disabled={busy}>{busy ? '잠시만요…' : '만들기'}</button>
      {msg && <div className="auth-msg">{msg}</div>}
    </form>
  )
}

function Onboard({ onDone, email }) {
  const [mode, setMode] = useState('join') // join | create
  return (
    <Shell>
      <div className="gate-who">{email}님, 함께 쓸 가계부를 연결해 주세요</div>
      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={mode === 'join' ? 'on' : ''} onClick={() => setMode('join')}>초대코드로 참여</button>
        <button className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>새 가계부 만들기</button>
      </div>
      {mode === 'join' ? <JoinForm onDone={onDone} /> : <CreateForm onDone={onDone} />}
      <button className="btn ghost sm" style={{ marginTop: 14 }} onClick={() => supabase.auth.signOut()}>다른 계정으로 로그인</button>
    </Shell>
  )
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined) // undefined = 확인 중
  const [member, setMember] = useState(undefined)   // null = 가구 없음
  const [slots, setSlots] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const uid = session?.user?.id
  const loadMember = useCallback(async () => {
    if (!uid) { setMember(undefined); return }
    try {
      const list = await myMemberships(uid)
      const m = list[0] || null
      if (m) {
        const sl = await householdSlots(m.household_id)
        setProfiles(sl.length ? sl.map((x) => x.name) : [m.profile])
        setSlots(sl)
        setLastProfile(m.profile) // 열 때마다 내 이름으로 시작
      }
      setMember(m)
    } catch { setMember(null) }
  }, [uid])
  useEffect(() => { loadMember() }, [loadMember])

  if (session === undefined || (session && member === undefined)) return <Shell><div className="helper">불러오는 중…</div></Shell>
  if (!session) return <Login />
  if (!member) return <Onboard email={session.user.email} onDone={loadMember} />

  const value = {
    email: session.user.email,
    hid: member.household_id,
    myProfile: member.profile,
    householdName: member.ledger_households?.name,
    inviteCode: member.ledger_households?.invite_code,
    slots,
    reload: loadMember,
  }
  return <AuthCtx.Provider value={value}>{children(value)}</AuthCtx.Provider>
}
