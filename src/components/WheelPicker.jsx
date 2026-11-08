import { useEffect, useRef } from 'react'

const ITEM_H = 36

// 알람 앱처럼 위아래로 돌려서 고르는 휠 한 줄
// items: [{ value, label }], value: 선택된 value
export function Wheel({ items, value, onChange, width = 64 }) {
  const ref = useRef(null)
  const timer = useRef(null)
  const idx = Math.max(0, items.findIndex((it) => it.value === value))

  useEffect(() => {
    const el = ref.current
    if (el && Math.round(el.scrollTop / ITEM_H) !== idx) el.scrollTop = idx * ITEM_H
  }, [idx])

  const onScroll = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
      el.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })
      if (items[i].value !== value) onChange(items[i].value)
    }, 90)
  }

  return (
    <div className="wheel" style={{ width }}>
      <div className="wheel-scroll" ref={ref} onScroll={onScroll}>
        <div style={{ height: ITEM_H * 2 }} />
        {items.map((it, i) => (
          <div key={it.value} className={`wheel-item ${i === idx ? 'on' : ''}`}
            onClick={() => ref.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })}>{it.label}</div>
        ))}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
      <div className="wheel-band" />
    </div>
  )
}

const WD = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: pad(h), label: pad(h) }))
const MINS = Array.from({ length: 60 }, (_, m) => ({ value: pad(m), label: pad(m) }))

// 'YYYY-MM-DD' 기준 앞뒤 날짜 목록
function dateItems(center, before = 60, after = 30) {
  const out = []
  const base = new Date(`${center}T00:00:00Z`)
  for (let d = -before; d <= after; d++) {
    const x = new Date(base); x.setUTCDate(x.getUTCDate() + d)
    const v = x.toISOString().slice(0, 10)
    const label = d === 0 ? `${x.getUTCMonth() + 1}/${x.getUTCDate()}(${WD[x.getUTCDay()]}) 당일` : `${x.getUTCMonth() + 1}/${x.getUTCDate()}(${WD[x.getUTCDay()]})`
    out.push({ value: v, label })
  }
  return out
}

// 날짜 · 시 · 분 휠. value: 'YYYY-MM-DDTHH:MM'
export default function DateTimeWheel({ center, value, onChange }) {
  const [d, t] = value.split('T')
  const [h, mi] = t.split(':')
  const days = dateItems(center)
  return (
    <div className="wheel-row">
      <Wheel items={days} value={d} width={128} onChange={(nd) => onChange(`${nd}T${h}:${mi}`)} />
      <Wheel items={HOURS} value={h} width={56} onChange={(nh) => onChange(`${d}T${nh}:${mi}`)} />
      <span className="wheel-colon">:</span>
      <Wheel items={MINS} value={mi} width={56} onChange={(nm) => onChange(`${d}T${h}:${nm}`)} />
    </div>
  )
}
