import { useState } from 'react'
import { PROFILES } from '../data/defaults'
import DateTimeWheel from './WheelPicker'

// 'YYYY-MM-DDTHH:MM'(한국시간) <-> timestamptz 문자열
export const kstToIso = (v) => `${v}:00+09:00`
export const isoToKst = (ts) => new Date(Date.parse(ts) + 9 * 3600e3).toISOString().slice(0, 16)
export const fmtAlarm = (ts) => {
  const v = isoToKst(ts)
  return `${Number(v.slice(5, 7))}/${Number(v.slice(8, 10))} ${v.slice(11, 16)}`
}

function shiftDay(date, days) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const WD = ['일', '월', '화', '수', '목', '금', '토']
const label = (v) => {
  const x = new Date(`${v.slice(0, 10)}T00:00:00Z`)
  return `${x.getUTCMonth() + 1}/${x.getUTCDate()}(${WD[x.getUTCDay()]}) ${v.slice(11, 16)}`
}

// 받는 사람 + 알림 시각 목록(한국시간 'YYYY-MM-DDTHH:MM')을 고르는 편집기
// value: { to: ['창진'], alarms: [...] }
export default function NotifyEditor({ date, atTime, value, onChange }) {
  const { to, alarms } = value
  const [picking, setPicking] = useState(null) // { i: 고치는 알림 번호(-1=새로), v: 휠 값 }
  const set = (patch) => onChange({ ...value, ...patch })
  const toggleTo = (id) => set({ to: to.includes(id) ? to.filter((x) => x !== id) : [...to, id] })

  const openNew = () => {
    let v = `${date}T09:00`
    if (atTime) { // 일정 시간이 있으면 1시간 전을 기본값으로
      const [hh, mm] = atTime.split(':').map(Number)
      const t = hh * 60 + mm - 60
      const day = t < 0 ? shiftDay(date, -1) : date
      const m2 = (t + 1440) % 1440
      v = `${day}T${String(Math.floor(m2 / 60)).padStart(2, '0')}:${String(m2 % 60).padStart(2, '0')}`
    }
    setPicking({ i: -1, v })
  }
  const confirm = () => {
    const list = picking.i < 0 ? [...alarms, picking.v] : alarms.map((x, j) => (j === picking.i ? picking.v : x))
    set({ alarms: [...new Set(list)].sort() })
    setPicking(null)
  }

  return (
    <div className="cal-notify">
      <div className="cal-notify-row">
        <span className="helper">텔레그램 알림 받을 사람</span>
        {PROFILES.map((p) => (
          <button key={p.id} type="button" className={`chip ${to.includes(p.id) ? 'on' : ''}`} onClick={() => toggleTo(p.id)}>{p.id}</button>
        ))}
      </div>
      {to.length > 0 && (
        <>
          <div className="cal-notify-row">
            <span className="helper">알림 시각</span>
            {alarms.map((a, i) => (
              <span key={a} className="chip on alarm">
                <button type="button" onClick={() => setPicking({ i, v: a })}>⏰ {label(a)}</button>
                <button type="button" aria-label="알림 삭제" onClick={() => set({ alarms: alarms.filter((_, j) => j !== i) })}>✕</button>
              </span>
            ))}
            {!picking && <button type="button" className="chip" onClick={openNew}>+ 알림 추가</button>}
          </div>
          {picking && (
            <div className="wheel-box">
              <DateTimeWheel center={date} value={picking.v} onChange={(v) => setPicking({ ...picking, v })} />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button type="button" className="btn ghost sm" onClick={() => setPicking(null)}>취소</button>
                <button type="button" className="btn primary sm" onClick={confirm}>{picking.i < 0 ? '알림 추가' : '변경'}</button>
              </div>
            </div>
          )}
          {alarms.length === 0 && !picking && <div className="helper">등록하면 바로 한 번 알려줘요. 미리 받을 알림은 "+ 알림 추가"로 날짜·시·분을 골라 넣어요.</div>}
        </>
      )}
    </div>
  )
}
