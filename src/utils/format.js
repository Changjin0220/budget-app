// 숫자/통화 포맷 유틸

export function won(n) {
  if (n === '' || n === null || n === undefined || Number.isNaN(Number(n))) return '-'
  const v = Math.round(Number(n))
  if (v === 0) return '-'
  return v.toLocaleString('ko-KR')
}

// 항상 0도 0으로 표기 (합계 등)
export function num(n) {
  if (n === '' || n === null || n === undefined || Number.isNaN(Number(n))) return '0'
  return Math.round(Number(n)).toLocaleString('ko-KR')
}

// 부호 화살표 (연간/월간 대비 표시): 증가 ▲ 감소 ▼
export function deltaMark(n) {
  const v = Math.round(Number(n) || 0)
  if (v > 0) return { text: '▲' + Math.abs(v).toLocaleString('ko-KR'), cls: 'up' }
  if (v < 0) return { text: '▼' + Math.abs(v).toLocaleString('ko-KR'), cls: 'down' }
  return { text: '-', cls: 'flat' }
}

export function pct(n, digits = 0) {
  if (!Number.isFinite(n)) return '0%'
  return (n * 100).toFixed(digits) + '%'
}

export function parseNum(str) {
  if (str === '' || str === null || str === undefined) return ''
  const cleaned = String(str).replace(/[^0-9.-]/g, '')
  if (cleaned === '' || cleaned === '-') return ''
  const v = Number(cleaned)
  return Number.isNaN(v) ? '' : v
}

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
export const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
