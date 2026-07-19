// 다가오는 반복 결제(고정내역 + 할부) 계산 → 알림용
import { resolveBusinessDay, daysInMonth } from '../utils/holidays'
import { installmentOccurrences } from './installments'
import { kindOf } from './selectors'

function ymd(y, m, d) { return new Date(y, m - 1, d) }

// today 기준으로 daysAhead일 이내에 빠져나갈(또는 들어올) 반복 항목
export function upcomingPayments(state, daysAhead = 14) {
  const y = state.settings.year
  const now = new Date()
  // 데이터 연도와 실제 연도가 다르면, 같은 월/일을 데이터 연도에 매핑해 계절감 유지
  const today = now.getFullYear() === y ? now : new Date(y, now.getMonth(), now.getDate())
  const start = ymd(y, today.getMonth() + 1, today.getDate())
  start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + daysAhead)

  const items = []

  // 고정내역: 이번 달 + 다음 달 후보
  const baseMonth = today.getMonth() + 1
  const months = [baseMonth, baseMonth + 1].map((m) => (m > 12 ? { m: m - 12, y: y + 1 } : { m, y }))
  for (const fx of state.fixed) {
    if (!fx.major || !fx.amount) continue
    const kind = kindOf(state.settings, fx.major)
    for (const { m, y: yy } of months) {
      const r = resolveBusinessDay(yy, m, fx.day, fx.holiday)
      const dt = ymd(r.year, r.month, r.day)
      if (dt >= start && dt <= end) {
        items.push({
          date: dt, month: r.month, day: r.day, kind,
          major: fx.major, minor: fx.minor, amount: Number(fx.amount) || 0,
          payment: fx.payment, detail: fx.detail, source: 'fixed', id: fx.id + '-' + m,
        })
      }
    }
  }

  // 할부: 연중 회차 중 window 안
  for (const it of state.installments) {
    if (!it.apply || !it.major) continue
    const kind = kindOf(state.settings, it.major)
    for (const o of installmentOccurrences(it, y)) {
      const dt = ymd(y, o.month, o.day)
      if (dt >= start && dt <= end) {
        items.push({
          date: dt, month: o.month, day: o.day, kind,
          major: it.major, minor: it.minor, amount: o.amount,
          payment: it.payment, detail: `${it.detail || it.minor} (${o.seq}/${o.total}회)`,
          source: 'inst', id: it.id + '-' + o.seq,
        })
      }
    }
  }

  for (const x of items) x.daysAway = Math.round((x.date - start) / 86400000)
  items.sort((a, b) => a.date - b.date)
  // 중복 제거(같은 항목이 이번달/다음달 후보로 두 번 들어온 경우)
  const seen = new Set()
  return items.filter((x) => {
    const k = `${x.source}-${x.major}-${x.minor}-${x.month}-${x.day}-${x.amount}`
    if (seen.has(k)) return false
    seen.add(k); return true
  })
}

export function dueLabel(n) {
  if (n === 0) return '오늘'
  if (n === 1) return '내일'
  if (n < 0) return `${-n}일 지남`
  return `${n}일 뒤`
}
