import { resolveBusinessDay } from '../utils/holidays'
import { uid } from '../utils/id'

export const LOAN_METHODS = [
  { id: 'equalPayment', label: '원리금균등상환' },
  { id: 'equalPrincipal', label: '원금균등상환' },
  { id: 'bulletMaturity', label: '원금만기일시상환' },
  { id: 'graduated', label: '체증식상환' },
]

export function newLoan() {
  return {
    id: uid('ln'), name: '주택담보대출',
    principal: '', ratePercent: '', termMonths: '', graceMonths: '0',
    method: 'equalPayment',
    stepMonths: '12', growthPercent: '3',
    startYM: '', payday: '25', holiday: '-',
    interestMajor: '주거비', interestMinor: '대출이자',
    principalMajor: '저축', principalMinor: '주택담보원금',
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

const annuityFactor = (n, r) => (r > 0 ? (1 - Math.pow(1 + r, -n)) / r : n)
const discountFactor = (n, r) => (r > 0 ? Math.pow(1 + r, -n) : 1)

// 전체 상환 스케줄: [{ seq, payment, principal, interest, balance, cumPrincipal }]
export function loanSchedule(loan) {
  const principal = Number(loan.principal) || 0
  const term = parseInt(loan.termMonths, 10) || 0
  const grace = Math.min(Math.max(parseInt(loan.graceMonths, 10) || 0, 0), term)
  const monthlyRate = (Number(loan.ratePercent) || 0) / 100 / 12
  if (!principal || !term) return []

  const rows = []
  let balance = principal

  // 거치기간: 원금 상환 없이 이자만
  for (let k = 0; k < grace; k++) {
    const interest = Math.round(balance * monthlyRate)
    rows.push({ seq: k + 1, payment: interest, principal: 0, interest, balance })
  }

  const n = term - grace
  if (n <= 0) { addCumulative(rows); return rows }

  if (loan.method === 'bulletMaturity') {
    for (let k = 0; k < n; k++) {
      const isLast = k === n - 1
      const interest = Math.round(balance * monthlyRate)
      const princ = isLast ? balance : 0
      balance -= princ
      rows.push({ seq: grace + k + 1, payment: interest + princ, principal: princ, interest, balance })
    }
  } else if (loan.method === 'equalPrincipal') {
    const base = Math.floor(principal / n)
    for (let k = 0; k < n; k++) {
      const isLast = k === n - 1
      const interest = Math.round(balance * monthlyRate)
      const princ = isLast ? balance : base
      balance -= princ
      rows.push({ seq: grace + k + 1, payment: princ + interest, principal: princ, interest, balance })
    }
  } else if (loan.method === 'graduated') {
    const stepMonths = Math.max(parseInt(loan.stepMonths, 10) || 12, 1)
    const growth = 1 + (Number(loan.growthPercent) || 0) / 100
    const stepLens = []
    let remain = n
    while (remain > 0) { const len = Math.min(stepMonths, remain); stepLens.push(len); remain -= len }

    let denom = 0
    let offset = 0
    for (let s = 0; s < stepLens.length; s++) {
      denom += Math.pow(growth, s) * annuityFactor(stepLens[s], monthlyRate) * discountFactor(offset, monthlyRate)
      offset += stepLens[s]
    }
    const p0 = denom > 0 ? principal / denom : principal / n

    let k = 0
    for (let s = 0; s < stepLens.length; s++) {
      const payment = Math.round(p0 * Math.pow(growth, s))
      for (let j = 0; j < stepLens[s]; j++) {
        const isVeryLast = s === stepLens.length - 1 && j === stepLens[s] - 1
        const interest = Math.round(balance * monthlyRate)
        let princ = payment - interest
        // 초반 상환액이 이자보다 낮으면 princ가 음수(원금이 일시적으로 느는 역상환)일 수 있음 — 정상 동작이라 그대로 둠.
        // 단, 마지막 회차 또는 반올림 오차로 잔금보다 커지면 잔금에 맞춰 정리.
        if (isVeryLast || princ > balance) princ = balance
        balance -= princ
        rows.push({ seq: grace + k + 1, payment: princ + interest, principal: princ, interest, balance })
        k++
      }
    }
  } else { // equalPayment (기본)
    const payment = monthlyRate > 0
      ? Math.round(principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -n)))
      : Math.round(principal / n)
    for (let k = 0; k < n; k++) {
      const isLast = k === n - 1
      const interest = Math.round(balance * monthlyRate)
      let princ = payment - interest
      if (isLast || princ > balance || princ < 0) princ = balance
      balance -= princ
      rows.push({ seq: grace + k + 1, payment: princ + interest, principal: princ, interest, balance })
    }
  }

  addCumulative(rows)
  return rows
}

function addCumulative(rows) {
  let cum = 0
  for (const r of rows) { cum += r.principal; r.cumPrincipal = cum }
}

// 특정 연도에 해당하는 회차만: [{ seq, total, month, day, interest, principal }]
export function loanOccurrences(loan, year) {
  const start = parseStartYM(loan.startYM)
  if (!start) return []
  const [sy, sm] = start
  const schedule = loanSchedule(loan)
  const out = []
  for (const row of schedule) {
    let mm = sm + (row.seq - 1)
    let yy = sy + Math.floor((mm - 1) / 12)
    mm = ((mm - 1) % 12) + 1
    const r = resolveBusinessDay(yy, mm, loan.payday || 1, loan.holiday)
    if (r.year === year) {
      out.push({
        seq: row.seq, total: schedule.length, month: r.month, day: r.day,
        interest: row.interest, principal: row.principal,
      })
    }
  }
  return out
}

// 대출이자/원금이 들어갈 카테고리를 설정에서 찾고, 없으면 자동 생성
// (지출 > 주거비 > 대출이자, 저축 > 첫 저축그룹 > 주택담보원금)
export function ensureLoanCategories(settings) {
  let expGroup = settings.expense.find((g) => g.name === '주거비')
  if (!expGroup) {
    expGroup = { id: uid('g'), name: '주거비', subs: [] }
    settings.expense.unshift(expGroup)
  }
  if (!expGroup.subs.some((s) => s.name === '대출이자')) {
    expGroup.subs.push({ id: uid('s'), name: '대출이자' })
  }

  let savGroup = settings.saving[0]
  if (!savGroup) {
    savGroup = { id: uid('g'), name: '저축', subs: [] }
    settings.saving.push(savGroup)
  }
  if (!savGroup.subs.some((s) => s.name === '주택담보원금')) {
    savGroup.subs.push({ id: uid('s'), name: '주택담보원금' })
  }

  return {
    interestMajor: expGroup.name, interestMinor: '대출이자',
    principalMajor: savGroup.name, principalMinor: '주택담보원금',
  }
}

export function loanSummary(loan) {
  const schedule = loanSchedule(loan)
  if (schedule.length === 0) return null
  const totalInterest = schedule.reduce((a, r) => a + r.interest, 0)
  const totalPrincipal = schedule.reduce((a, r) => a + r.principal, 0)
  return {
    months: schedule.length,
    totalInterest,
    totalPrincipal,
    totalPayment: totalInterest + totalPrincipal,
    firstPayment: schedule[0]?.payment || 0,
    isLevel: loan.method === 'equalPayment' && (parseInt(loan.graceMonths, 10) || 0) === 0,
  }
}
