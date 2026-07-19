import { useMemo, useState, useEffect, useRef } from 'react'
import { useApp } from '../data/store'
import { upcomingPayments, dueLabel } from '../data/reminders'
import { won } from '../utils/format'
import { kindTag } from './fields'
import { IconBell } from './icons'
import './reminders.css'

function kindColor(kind) {
  return kind === 'income' ? 'var(--gold-400)' : kind === 'saving' ? 'var(--mint-400)' : 'var(--lav-400)'
}

function Row({ r }) {
  const soon = r.daysAway <= 2
  return (
    <div className="rmd-row">
      <div className="rmd-date" style={{ background: kindColor(r.kind) }}>
        <b>{r.month}/{r.day}</b>
        <span className={soon ? 'soon' : ''}>{dueLabel(r.daysAway)}</span>
      </div>
      <div className="rmd-body">
        <div className="rmd-title">{r.major} · {r.minor} {kindTag(r.kind)}</div>
        <div className="rmd-sub">{r.detail || (r.payment ? r.payment : '')}</div>
      </div>
      <div className="rmd-amt num" style={{ color: r.kind === 'income' ? 'var(--plus)' : 'var(--ink)' }}>
        {r.kind === 'income' ? '+' : '-'}{won(r.amount)}
      </div>
    </div>
  )
}

export function useUpcoming(days = 14) {
  const { state } = useApp()
  return useMemo(() => upcomingPayments(state, days), [state, days])
}

// 대시보드/월간 카드용
export function RemindersCard({ days = 14 }) {
  const list = useUpcoming(days)
  const outSum = list.filter((x) => x.kind !== 'income').reduce((a, x) => a + x.amount, 0)
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', padding: '15px 18px 0' }}>
        <div className="card-title"><span className="dot" style={{ background: '#f2a98f' }} />다가오는 반복 결제 <span className="helper">({days}일 이내)</span></div>
        <div style={{ flex: 1 }} />
        {outSum > 0 && <span className="pill expense num">예정 지출 {won(outSum)}</span>}
      </div>
      <div className="card-pad">
        {list.length === 0
          ? <div className="empty">{days}일 이내 예정된 고정 결제가 없어요</div>
          : <div className="rmd-list">{list.map((r) => <Row key={r.id} r={r} />)}</div>}
      </div>
    </div>
  )
}

// 상단바 벨 + 팝오버
export function RemindersBell() {
  const list = useUpcoming(14)
  const soon = list.filter((x) => x.daysAway <= 3)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const notify = async () => {
    if (!('Notification' in window)) return
    let perm = Notification.permission
    if (perm === 'default') perm = await Notification.requestPermission()
    if (perm === 'granted' && soon.length) {
      new Notification('오늘/곧 빠져나갈 고정 결제', {
        body: soon.slice(0, 3).map((x) => `${x.month}/${x.day} ${x.minor} ${won(x.amount)}`).join('\n'),
      })
    }
  }

  return (
    <div className="rmd-bell" ref={ref}>
      <button className="bell-btn" onClick={() => setOpen((v) => !v)} title="다가오는 반복 결제">
        <IconBell size={17} />{soon.length > 0 && <span className="bell-badge">{soon.length}</span>}
      </button>
      {open && (
        <div className="bell-pop">
          <div className="bell-pop-head">
            <b><IconBell size={14} />다가오는 반복 결제</b>
            <span className="helper">14일 이내</span>
          </div>
          <div className="bell-pop-body">
            {list.length === 0
              ? <div className="empty" style={{ padding: 24 }}>예정된 결제가 없어요</div>
              : <div className="rmd-list">{list.map((r) => <Row key={r.id} r={r} />)}</div>}
          </div>
          {('Notification' in window) && list.length > 0 && (
            <div className="bell-pop-foot">
              <button className="btn sm" onClick={notify}><IconBell size={13} />브라우저 알림 받기</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
