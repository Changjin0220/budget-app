import { resolveBusinessDay } from '../utils/holidays'
import { uid } from '../utils/id'

export function newInstallment() {
  return {
    id: uid('it'), apply: true, done: false,
    major: '', minor: '', total: '', payment: '',
    startYM: '', rate: '', months: '', partialFree: '',
    payday: '', holiday: '-', detail: '', memo: '',
  }
}

export function parseStartYM(str) {
  if (!str) return null
  const parts = String(str).split(/[^0-9]+/).filter(Boolean)
  if (parts.length < 2) return null
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (!y || !m || m < 1 || m > 12) return null
  return [y, m]
}

// 월별 상환 금액 (연이율 적용, 부분무이자 개월수 이후만 이자 부과 — 간단 근사)
export function monthlyAmounts(it) {
  const months = parseInt(it.months, 10) || 0
  const total = Number(it.total) || 0
  if (!months || !total) return []
  const principal = Math.floor(total / months)
  const arr = []
  const rate = (Number(it.rate) || 0) / 100 / 12 // 월이율
  const freeN = parseInt(it.partialFree, 10) || 0
  let remaining = total
  for (let k = 0; k < months; k++) {
    let amt = k === months - 1 ? total - principal * (months - 1) : principal
    if (rate > 0 && k >= freeN) amt += Math.round(remaining * rate)
    remaining -= principal
    arr.push(amt)
  }
  return arr
}

// 특정 연도에 해당하는 회차 목록 반환
// [{ seq, total, month, day, amount }]
export function installmentOccurrences(it, year) {
  const start = parseStartYM(it.startYM)
  const months = parseInt(it.months, 10) || 0
  if (!start || !months) return []
  const [sy, sm] = start
  const amounts = monthlyAmounts(it)
  const out = []
  for (let k = 0; k < months; k++) {
    let mm = sm + k
    let yy = sy + Math.floor((mm - 1) / 12)
    mm = ((mm - 1) % 12) + 1
    const r = resolveBusinessDay(yy, mm, it.payday || 1, it.holiday)
    if (r.year === year) {
      out.push({ seq: k + 1, total: months, month: r.month, day: r.day, amount: amounts[k] })
    }
  }
  return out
}
