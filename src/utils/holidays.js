// 한국 공휴일 + 영업일 계산 (고정내역/할부 '휴일옵션' 처리)
// 주말(토/일) + 공휴일을 비영업일로 간주.
// 음력 공휴일(설/추석)은 매년 달라 하드코딩 테이블로 관리. 필요 시 연도 추가.

const FIXED_SOLAR = [
  '01-01', // 신정
  '03-01', // 삼일절
  '05-05', // 어린이날
  '06-06', // 현충일
  '08-15', // 광복절
  '10-03', // 개천절
  '10-09', // 한글날
  '12-25', // 성탄절
]

// 연도별 음력/대체 공휴일 (YYYY-MM-DD). 2025~2027 수록.
const LUNAR_AND_SUBSTITUTE = {
  2025: ['2025-01-28', '2025-01-29', '2025-01-30', '2025-03-03', '2025-05-06',
    '2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09'],
  2026: ['2026-02-16', '2026-02-17', '2026-02-18', '2026-05-25',
    '2026-09-24', '2026-09-25', '2026-09-26'],
  2027: ['2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', '2027-05-13',
    '2027-09-14', '2027-09-15', '2027-09-16', '2027-10-04'],
}

function pad(n) { return String(n).padStart(2, '0') }
function key(y, m, d) { return `${y}-${pad(m)}-${pad(d)}` }

export function isHoliday(year, month, day) {
  const d = new Date(year, month - 1, day)
  const wd = d.getDay()
  if (wd === 0 || wd === 6) return true // 주말
  const md = `${pad(month)}-${pad(day)}`
  if (FIXED_SOLAR.includes(md)) return true
  const list = LUNAR_AND_SUBSTITUTE[year] || []
  if (list.includes(key(year, month, day))) return true
  return false
}

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

export const HOLIDAY_OPTIONS = ['-', '휴일 직후 영업일', '휴일 직전 영업일']

// 기준 day(1~31 또는 '말일')를 휴일옵션에 맞춰 실제 영업일로 보정
// 반환: { day, month } — 옵션 때문에 달을 넘어갈 수도 있으므로 month도 반환
export function resolveBusinessDay(year, month, rawDay, option) {
  let day
  if (rawDay === '말일' || rawDay === 'last') day = daysInMonth(year, month)
  else day = Math.min(Math.max(parseInt(rawDay, 10) || 1, 1), daysInMonth(year, month))

  if (!option || option === '-') return { year, month, day }

  let y = year, m = month, dd = day
  const step = option === '휴일 직전 영업일' ? -1 : 1
  let guard = 0
  while (isHoliday(y, m, dd) && guard < 40) {
    dd += step
    if (dd > daysInMonth(y, m)) { m += 1; dd = 1; if (m > 12) { m = 1; y += 1 } }
    if (dd < 1) { m -= 1; if (m < 1) { m = 12; y -= 1 } dd = daysInMonth(y, m) }
    guard++
  }
  return { year: y, month: m, day: dd }
}
