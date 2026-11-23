import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase, myMemberships, createHousehold, joinHousehold } from '../data/auth'
import { setLastProfile } from '../data/storage'
import { PROFILES } from '../data/defaults'
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

function Onboard({ onDone, email }) {
  const [mode, setMode] = useState('join') // join | create
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [profile, setProfile] = useState(PROFILES[0].id)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setMsg('')
    try {
      if (mode === 'join') await joinHousehold(code, profile)
      else await createHousehold(name || '우리집', profile)
      setLastProfile(profile)
      onDone()
    } catch (err) { setMsg(friendly(err)) }
    finally { setBusy(false) }
  }

  return (
    <Shell>
      <div className="gate-who">{email}님, 함께 쓸 가계부를 연결해 주세요</div>
      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={mode === 'join' ? 'on' : ''} onClick={() => setMode('join')}>초대코드로 참여</button>
        <button className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>새 가계부 만들기</button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'join'
          ? <input className="input" placeholder="초대코드 8자리" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required maxLength={8} style={{ letterSpacing: 2, textAlign: 'center' }} />
          : <input className="input" placeholder="가계부 이름 (예: 우리집)" value={name} onChange={(e) => setName(e.target.value)} />}
        <div className="helper" style={{ textAlign: 'left' }}>가계부에서 쓸 내 이름</div>
        <div className="seg" style={{ justifySelf: 'center' }}>
          {PROFILES.map((p) => (
            <button type="button" key={p.id} className={profile === p.id ? 'on' : ''} onClick={() => setProfile(p.id)}>{p.name}</button>
          ))}
        </div>
        <button className="btn primary" disabled={busy}>{busy ? '잠시만요…' : mode === 'join' ? '참여하기' : '만들기'}</button>
      </form>
      {msg && <div className="auth-msg">{msg}</div>}
      <button className="btn ghost sm" style={{ marginTop: 14 }} onClick={() => supabase.auth.signOut()}>다른 계정으로 로그인</button>
    </Shell>
  )
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined) // undefined = 확인 중
  const [member, setMember] = useState(undefined)   // null = 가구 없음

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
      if (m) setLastProfile(m.profile) // 열 때마다 내 이름으로 시작
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
    householdName: member.households?.name,
    inviteCode: member.households?.invite_code,
  }
  return <AuthCtx.Provider value={value}>{children(value)}</AuthCtx.Provider>
}
