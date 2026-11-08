import { PROFILES } from '../data/defaults'

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

// 받는 사람 + 알림 시각 목록(한국시간 로컬 문자열)을 고르는 편집기
// value: { to: ['창진'], alarms: ['2026-11-12T21:00', ...] }
export default function NotifyEditor({ date, atTime, value, onChange }) {
  const { to, alarms } = value
  const set = (patch) => onChange({ ...value, ...patch })
  const toggleTo = (id) => set({ to: to.includes(id) ? to.filter((x) => x !== id) : [...to, id] })
  const addAlarm = (v) => { if (v && !alarms.includes(v)) set({ alarms: [...alarms, v].sort() }) }

  const oneHourBefore = () => {
    const [h, mi] = atTime.split(':').map(Number)
    const t = h * 60 + mi - 60
    const day = t < 0 ? shiftDay(date, -1) : date
    const mm = (t + 1440) % 1440
    return `${day}T${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`
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
            <span className="helper">알림 추가</span>
            <button type="button" className="chip" onClick={() => addAlarm(`${shiftDay(date, -1)}T21:00`)}>+ 전날 저녁</button>
            <button type="button" className="chip" onClick={() => addAlarm(`${date}T08:00`)}>+ 당일 아침</button>
            {atTime && <button type="button" className="chip" onClick={() => addAlarm(oneHourBefore())}>+ 1시간 전</button>}
            <button type="button" className="chip" onClick={() => addAlarm(`${date}T09:00`)}>+ 직접 설정</button>
          </div>
          {alarms.map((a, i) => (
            <div key={i} className="cal-notify-row">
              <span style={{ fontSize: 13 }}>⏰</span>
              <input className="input" type="datetime-local" style={{ flex: 1, minWidth: 0, maxWidth: 230 }} value={a}
                onChange={(e) => set({ alarms: alarms.map((x, j) => (j === i ? e.target.value : x)).filter(Boolean) })} />
              <button type="button" className="btn ghost sm" onClick={() => set({ alarms: alarms.filter((_, j) => j !== i) })} aria-label="알림 삭제">✕</button>
            </div>
          ))}
          {alarms.length === 0 && <div className="helper">등록할 때 바로 한 번 알려줘요. 미리 알림은 위에서 추가하고 시간을 바꿀 수 있어요.</div>}
        </>
      )}
    </div>
  )
}
