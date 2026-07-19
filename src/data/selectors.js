// 파생 계산 (집계, 저축률 등) — 원본 구글시트의 자동 계산 대체

export function incomeGroups(s) { return s.income || [] }
export function savingGroups(s) { return s.saving || [] }
export function expenseGroups(s) { return s.expense || [] }

// 모든 대분류 목록 (kind 포함)
export function allMajors(s) {
  const out = []
  for (const g of s.income || []) out.push({ name: g.name, kind: 'income', subs: g.subs.map((x) => x.name) })
  for (const g of s.saving || []) out.push({ name: g.name, kind: 'saving', subs: g.subs.map((x) => x.name) })
  for (const g of s.expense || []) out.push({ name: g.name, kind: 'expense', subs: g.subs.map((x) => x.name) })
  return out
}

export function majorMap(s) {
  const m = {}
  for (const g of allMajors(s)) m[g.name] = g
  return m
}

export function kindOf(s, majorName) {
  return majorMap(s)[majorName]?.kind || 'expense'
}
export function subsOf(s, majorName) {
  return majorMap(s)[majorName]?.subs || []
}

const val = (r) => Number(r.amount) || 0

export function splitRows(rows) {
  return {
    income: rows.filter((r) => r.kind === 'income'),
    saving: rows.filter((r) => r.kind === 'saving'),
    expense: rows.filter((r) => r.kind === 'expense'),
  }
}

export function monthTotals(rows) {
  const { income, saving, expense } = splitRows(rows)
  const totalIncome = income.reduce((a, r) => a + val(r), 0)
  const totalSaving = saving.reduce((a, r) => a + val(r), 0)
  const totalExpense = expense.reduce((a, r) => a + val(r), 0)
  const leftover = totalIncome - totalSaving - totalExpense // 잔여현금
  const savingRate = totalIncome > 0 ? (totalSaving + Math.max(leftover, 0)) / totalIncome : 0
  // 대시보드/월간 요약의 '저축률'은 (저축+잔여현금)/수입 을 사용 (원본과 동일 취지)
  return { totalIncome, totalSaving, totalExpense, leftover, savingRate }
}

// 저축률(대시보드): 원본은 (총수입-총지출)/총수입. 여기선 저축+잔여 = 수입-지출 이므로 동일.
export function savingRateSimple(rows) {
  const { totalIncome, totalExpense } = monthTotals(rows)
  if (totalIncome <= 0) return 0
  return (totalIncome - totalExpense) / totalIncome
}

// 대분류별 합계 (kind 지정)
export function byMajor(rows, kind) {
  const map = {}
  for (const r of rows) {
    if (kind && r.kind !== kind) continue
    map[r.major] = (map[r.major] || 0) + val(r)
  }
  return map
}

// 소분류별 합계 (kind 지정) — key: "대분류·소분류" 또는 소분류만
export function byMinor(rows, kind, keyMode = 'minor') {
  const map = {}
  for (const r of rows) {
    if (kind && r.kind !== kind) continue
    const k = keyMode === 'full' ? `${r.major}·${r.minor}` : (r.minor || '(미지정)')
    map[k] = (map[k] || 0) + val(r)
  }
  return map
}

export function byPayment(rows, payments) {
  const map = {}
  for (const p of payments) map[p] = 0
  for (const r of rows) {
    if (r.kind !== 'expense') continue
    if (!r.payment) continue
    map[r.payment] = (map[r.payment] || 0) + val(r)
  }
  return map
}

// 일별 지출 (day → amount)
export function byDaySpend(rows, daysInMonth) {
  const arr = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, amount: 0 }))
  for (const r of rows) {
    if (r.kind !== 'expense') continue
    const d = Number(r.day)
    if (d >= 1 && d <= daysInMonth) arr[d - 1].amount += val(r)
  }
  return arr
}

// map → 정렬된 top N 배열 [{name, value}]
export function topN(map, n) {
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
}

export function sortedEntries(map) {
  return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

// 무지출 일수 (지출 있는 날 제외한, 해당월 총 일수)
export function noSpendDays(rows, daysInMonth) {
  const spent = new Set()
  for (const r of rows) if (r.kind === 'expense' && val(r) > 0) spent.add(Number(r.day))
  return daysInMonth - spent.size
}

// 연간 집계: monthly 전체를 대분류/소분류 x 12개월 매트릭스로
export function annualMatrix(monthly, settings) {
  const majors = allMajors(settings)
  const result = majors.map((g) => {
    const subRows = g.subs.map((sub) => {
      const months = Array.from({ length: 12 }, (_, i) => {
        const rows = monthly[i + 1]?.rows || []
        return rows.filter((r) => r.major === g.name && r.minor === sub && r.kind === g.kind)
          .reduce((a, r) => a + val(r), 0)
      })
      const total = months.reduce((a, b) => a + b, 0)
      const nonZero = months.filter((x) => x !== 0).length
      const avg = nonZero ? total / nonZero : 0
      return { name: sub, months, total, avg }
    })
    const groupMonths = Array.from({ length: 12 }, (_, i) => subRows.reduce((a, s) => a + s.months[i], 0))
    const groupTotal = groupMonths.reduce((a, b) => a + b, 0)
    const gnz = groupMonths.filter((x) => x !== 0).length
    return { name: g.name, kind: g.kind, subs: subRows, months: groupMonths, total: groupTotal, avg: gnz ? groupTotal / gnz : 0 }
  })
  return result
}

export function annualSectionTotals(matrix, kind) {
  const groups = matrix.filter((g) => g.kind === kind)
  const months = Array.from({ length: 12 }, (_, i) => groups.reduce((a, g) => a + g.months[i], 0))
  const total = months.reduce((a, b) => a + b, 0)
  return { months, total }
}
