import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../data/store'
import { cloudEnabled, cloudLoad } from '../data/cloud'
import { loadState } from '../data/storage'
import { notesFetch, notesAdd, notesDelete } from '../data/calendarNotes'
import { PROFILES, COMMON_ID } from '../data/defaults'
import { Card } from '../components/ui'
import { daysInMonth, isHoliday } from '../utils/holidays'
import { num } from '../utils/format'
import { IconTrash } from '../components/icons'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n) => String(n).padStart(2, '0')
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

// 칸이 좁아서 큰 금액은 '만' 단위로 줄여 표시
function compact(n) {
  const a = Math.abs(n)
  if (a >= 100000000) return `${(a / 100000000).toFixed(1).replace(/\.0$/, '')}억`
  if (a >= 10000) return `${(a / 10000).toFixed(a >= 100000 ? 0 : 1).replace(/\.0$/, '')}만`
  return num(a)
}

const authorColor = (name) => PROFILES.find((p) => p.id === name)?.color || 'var(--mint-500)'

export default function Calendar() {
  const { state, profile, isCommon, syncConfig, showToast } = useApp()
  const year = state.settings.year
  const today = new Date()
  const [m, setM] = useState(() => (today.getFullYear() === year ? today.getMonth() + 1 : 1))
  const [mode, setMode] = useState('money') // money | notes
  const [sel, setSel] = useState(() => (today.getFullYear() === year ? today.getDate() : 1))
  const dim = daysInMonth(year, m)
  const firstWd = new Date(year, m - 1, 1).getDay()
  const isToday = (d) => today.getFullYear() === year && today.getMonth() + 1 === m && today.getDate() === d

  useEffect(() => { if (sel > dim) setSel(dim) }, [dim, sel])

  // ---- 누구 기준으로 볼지 (창진 / 효연 / 공통) ----
  // 로그인한 프로필과 상관없이 캘린더에서만 전환. 상대방 데이터는 읽기만 함(저장 안 함).
  const [who, setWho] = useState(() => (isCommon ? COMMON_ID : profile))
  const other = isCommon ? null : PROFILES.find((p) => p.id !== profile)?.id
  const [otherMonthly, setOtherMonthly] = useState(null)
  const loadOther = useCallback(async () => {
    if (!other) return
    let s = loadState(other)
    if (cloudEnabled(syncConfig)) {
      try { const r = await cloudLoad(syncConfig, other); if (r?.state) s = r.state } catch { /* 로컬 사본으로 */ }
    }
    setOtherMonthly(s?.monthly || {})
  }, [other, syncConfig])
  useEffect(() => { if (who !== profile) loadOther() }, [who, profile, loadOther])

  // ---- 수입/지출 집계 ----
  const rows = useMemo(() => {
    const tag = (list, owner) => (list || []).map((r) => ({ ...r, _owner: r._owner || owner }))
    if (isCommon) {
      const all = state.monthly[m]?.rows || []
      return who === COMMON_ID ? all : all.filter((r) => r._owner === who)
    }
    const mine = tag(state.monthly[m]?.rows, profile)
    const theirs = tag(otherMonthly?.[m]?.rows, other)
    if (who === profile) return mine
    if (who === other) return theirs
    return [...mine, ...theirs]
  }, [isCommon, who, state, m, profile, other, otherMonthly])
  const byDay = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const d = Number(r.day) || 0
      const amt = Number(r.amount) || 0
      if (!d || !amt) continue
      const o = (map[d] ||= { income: 0, expense: 0, saving: 0 })
      o[r.kind] = (o[r.kind] || 0) + amt
    }
    return map
  }, [rows])
  const monthIn = Object.values(byDay).reduce((a, o) => a + o.income, 0)
  const monthOut = Object.values(byDay).reduce((a, o) => a + o.expense, 0)

  // ---- 공유 일정 ----
  const on = cloudEnabled(syncConfig)
  const [notes, setNotes] = useState([])
  const [notesErr, setNotesErr] = useState('')
  const [draft, setDraft] = useState('')
  const [atTime, setAtTime] = useState('')
  const [notifyTo, setNotifyTo] = useState([])
  const [remind, setRemind] = useState(['eve'])
  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const [busy, setBusy] = useState(false)

  const loadNotes = useCallback(async () => {
    if (!on) return
    try {
      const list = await notesFetch(syncConfig, ymd(year, m, 1), ymd(year, m, dim))
      setNotes(list); setNotesErr('')
    } catch (e) {
      setNotesErr(/404|42P01|does not exist|PGRST205/.test(String(e.message)) ? 'no-table' : String(e.message || e))
    }
  }, [on, syncConfig, year, m, dim])

  useEffect(() => {
    loadNotes()
    if (!on) return
    const onFocus = () => loadNotes()
    window.addEventListener('focus', onFocus)
    const iv = setInterval(loadNotes, 30000) // 상대가 쓴 메모도 30초마다 반영
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv) }
  }, [loadNotes, on])

  const notesByDay = useMemo(() => {
    const map = {}
    for (const n of notes) {
      const d = Number(String(n.date).slice(8, 10))
      ;(map[d] ||= []).push(n)
    }
    return map
  }, [notes])

  const addNote = async () => {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      const rm = remind.filter((k) => k !== '1h' || atTime)
      const row = await notesAdd(syncConfig, { date: ymd(year, m, sel), text, author: isCommon ? '공통' : profile, atTime, notifyTo, remind: rm })
      setNotes((xs) => [...xs, row]); setDraft(''); setAtTime('')
      if (notifyTo.length) showToast(`${notifyTo.join('·')}에게 텔레그램 알림을 보냈어요`)
    } catch (e) { showToast('메모 저장 실패: ' + String(e.message || e).slice(0, 40)) }
    finally { setBusy(false) }
  }
  const delNote = async (id) => {
    try { await notesDelete(syncConfig, id); setNotes((xs) => xs.filter((x) => x.id !== id)) }
    catch (e) { showToast('삭제 실패: ' + String(e.message || e).slice(0, 40)) }
  }

  // ---- 그리드 ----
  const cells = []
  for (let i = 0; i < firstWd; i++) cells.push(null)
  for (let d = 1; d <= dim; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)

  const selRows = rows.filter((r) => Number(r.day) === sel && Number(r.amount))
  const selNotes = notesByDay[sel] || []

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card pad>
        <div className="cal-head">
          <div className="cal-nav">
            <button className="btn ghost sm" disabled={m <= 1} onClick={() => setM(m - 1)} aria-label="이전 달">‹</button>
            <div className="cal-title">{year}년 {m}월</div>
            <button className="btn ghost sm" disabled={m >= 12} onClick={() => setM(m + 1)} aria-label="다음 달">›</button>
          </div>
          <div className="seg">
            <button className={mode === 'money' ? 'on' : ''} onClick={() => setMode('money')}>수입/지출</button>
            <button className={mode === 'notes' ? 'on' : ''} onClick={() => setMode('notes')}>일정</button>
          </div>
        </div>

        {mode === 'money' && (
          <div className="cal-sum">
            <span>수입 <b className="pos">{num(monthIn)}</b></span>
            <span>지출 <b className="neg">{num(monthOut)}</b></span>
            <div className="seg sm" style={{ marginLeft: 'auto' }}>
              {[...PROFILES.map((p) => p.id), COMMON_ID].map((id) => (
                <button key={id} className={who === id ? 'on' : ''} onClick={() => setWho(id)}>{id}</button>
              ))}
            </div>
          </div>
        )}
        {mode === 'money' && who !== COMMON_ID && who !== profile && !isCommon && otherMonthly === null && (
          <div className="helper" style={{ margin: '4px 0' }}>{who} 내역 불러오는 중…</div>
        )}
        {mode === 'notes' && !on && (
          <div className="helper" style={{ margin: '8px 0' }}>일정 공유는 설정 → 클라우드 동기화를 켜야 사용할 수 있어요.</div>
        )}
        {mode === 'notes' && on && notesErr === 'no-table' && (
          <div className="helper" style={{ margin: '8px 0' }}>일정 저장소(calendar_notes)가 아직 준비되지 않았어요.</div>
        )}

        <div className="cal-grid">
          {WEEK.map((w, i) => <div key={w} className={`cal-wd ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>{w}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} className="cal-cell empty" />
            const wd = (firstWd + d - 1) % 7
            const red = wd === 0 || (wd !== 6 && isHoliday(year, m, d))
            const o = byDay[d]
            const ns = notesByDay[d] || []
            return (
              <button key={d} className={`cal-cell ${sel === d ? 'sel' : ''} ${isToday(d) ? 'today' : ''}`} onClick={() => setSel(d)}>
                <span className={`cal-d ${red ? 'sun' : wd === 6 ? 'sat' : ''}`}>{d}</span>
                {mode === 'money' && o && (
                  <>
                    {o.income > 0 && <span className="cal-amt pos">+{compact(o.income)}</span>}
                    {o.expense > 0 && <span className="cal-amt neg">-{compact(o.expense)}</span>}
                  </>
                )}
                {mode === 'notes' && ns.slice(0, 2).map((n) => (
                  <span key={n.id} className="cal-note" style={{ borderColor: authorColor(n.author) }}>{n.at_time ? n.at_time.slice(0, 5) + ' ' : ''}{n.text}</span>
                ))}
                {mode === 'notes' && ns.length > 2 && <span className="cal-more">+{ns.length - 2}</span>}
              </button>
            )
          })}
        </div>
      </Card>

      <Card title={`${m}월 ${sel}일 (${WEEK[(firstWd + sel - 1) % 7]})`} dot={mode === 'money' ? 'var(--gold-400)' : 'var(--mint-400)'}>
        {mode === 'money' && (
          selRows.length === 0 ? <div className="helper">이 날은 내역이 없어요.</div> : (
            <div className="cal-list">
              {selRows.map((r, i) => (
                <div key={`${r.id}-${i}`} className="cal-li">
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.detail || r.minor || r.major || '(내용 없음)'}</div>
                    <div className="helper">{[r.major, r.minor, r.payment, r._owner].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className={`num ${r.kind === 'income' ? 'pos' : r.kind === 'expense' ? 'neg' : ''}`} style={{ fontWeight: 800 }}>
                    {r.kind === 'income' ? '+' : r.kind === 'expense' ? '-' : ''}{num(Number(r.amount))}
                    {r.kind === 'saving' && <span className="helper"> 저축</span>}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {mode === 'notes' && (
          <>
            {selNotes.length === 0 && <div className="helper" style={{ marginBottom: 10 }}>등록된 일정이 없어요.</div>}
            <div className="cal-list">
              {selNotes.map((n) => (
                <div key={n.id} className="cal-li">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
                    <span className="pill" style={{ background: authorColor(n.author), color: '#fff', flex: 'none' }}>{n.author}</span>
                    <span style={{ wordBreak: 'break-word' }}>
                      {n.at_time && <b style={{ marginRight: 6 }}>{n.at_time.slice(0, 5)}</b>}{n.text}
                      {n.notify_to?.length > 0 && <span className="helper"> · 🔔 {n.notify_to.join('·')}</span>}
                    </span>
                  </div>
                  <button className="btn ghost sm danger" onClick={() => delNote(n.id)} aria-label="삭제"><IconTrash size={13} /></button>
                </div>
              ))}
            </div>
            {on && notesErr !== 'no-table' && (
              <>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input className="input" type="time" style={{ flex: 'none', width: 120 }} value={atTime}
                  onChange={(e) => setAtTime(e.target.value)} aria-label="시간 (선택)" />
                <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="일정 메모 (예: 첫째 병원 10시)"
                  value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addNote() }} />
                <button className="btn primary" disabled={!draft.trim() || busy} onClick={addNote}>추가</button>
              </div>
              <div className="cal-notify">
                <span className="helper">텔레그램 알림</span>
                {PROFILES.map((p) => (
                  <button key={p.id} className={`chip ${notifyTo.includes(p.id) ? 'on' : ''}`} onClick={() => toggle(notifyTo, setNotifyTo, p.id)}>{p.id}</button>
                ))}
                {notifyTo.length > 0 && (
                  <>
                    <span className="helper" style={{ marginLeft: 6 }}>미리 알림</span>
                    {[['eve', '전날 저녁 9시'], ['morning', '당일 아침 8시'], ['1h', '1시간 전']].map(([k, label]) => (
                      <button key={k} className={`chip ${remind.includes(k) ? 'on' : ''}`} disabled={k === '1h' && !atTime}
                        title={k === '1h' && !atTime ? '시간을 입력해야 쓸 수 있어요' : ''}
                        onClick={() => toggle(remind, setRemind, k)}>{label}</button>
                    ))}
                  </>
                )}
              </div>
              </>
            )}
            {notesErr && notesErr !== 'no-table' && <div className="helper neg" style={{ marginTop: 8 }}>{notesErr}</div>}
          </>
        )}
      </Card>
    </div>
  )
}
