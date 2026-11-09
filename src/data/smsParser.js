// ============================================================
// 카드 승인 문자(SMS) 해석기
// - 우리카드 / KB국민카드 승인·취소 문자를 대상으로 하되, 형식이 조금 달라도
//   "금액(원)", "MM/DD HH:mm", "가맹점" 패턴으로 최대한 뽑아냄
// - 실제 문자 형식은 카드사마다 다르고 바뀔 수 있으니, 여기 정규식만 고치면 됨
// ============================================================

const SKIP_LINE = /(누적|잔액|한도|사용가능|web발신|님$|님\s*$)/i

function detectCard(text) {
  if (/우리/.test(text)) return '우리'
  if (/(KB|국민)/i.test(text)) return 'KB국민'
  if (/신한/.test(text)) return '신한'
  if (/현대/.test(text)) return '현대'
  if (/삼성/.test(text)) return '삼성'
  return ''
}

// 반환: { ok, cancel, amount, month, day, time, merchant, card, check, installment, reason }
export function parseCardSms(body, receivedAt) {
  const text = String(body || '').replace(/\r/g, '')
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const res = { ok: false, cancel: /취소/.test(text), card: detectCard(text), check: /체크/.test(text) }

  // 금액: '누적/잔액' 줄을 제외한 첫 "숫자원"
  let amountLine = -1
  for (let i = 0; i < lines.length; i++) {
    if (/(누적|잔액|한도)/.test(lines[i])) continue
    const m = lines[i].match(/([\d,]+)\s*원/)
    if (m) { res.amount = Number(m[1].replace(/,/g, '')); amountLine = i; break }
  }
  const inst = text.match(/(\d{1,2})\s*개월/)
  if (inst) res.installment = Number(inst[1])

  // 날짜/시간: 11/03 14:22 (없으면 수신 시각 사용)
  let dateLine = -1
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/(\d{1,2})\/(\d{1,2})\s*(\d{1,2}:\d{2})?/)
    if (m) { res.month = Number(m[1]); res.day = Number(m[2]); res.time = m[3] || ''; dateLine = i; break }
  }
  if (!res.month && receivedAt) {
    const d = new Date(receivedAt)
    if (!isNaN(d)) { res.month = d.getMonth() + 1; res.day = d.getDate() }
  }

  // 가맹점: 날짜 줄 뒤의 첫 일반 줄 → 없으면 날짜 줄의 시간 뒤 텍스트 → 없으면 금액 줄 앞 일반 줄
  // 카드명 줄(우리(1234)승인, KB국민체크(5678) 등)·날짜 줄·금액 줄·누적 줄은 제외, 끝의 '승인/취소'는 떼어냄
  const clean = (l) => l.replace(/\s*(승인|취소)\s*$/, '').trim()
  const isPlain = (l) => {
    if (!l || SKIP_LINE.test(l) || /[\d,]+\s*원/.test(l) || /\d{1,2}\/\d{1,2}/.test(l)) return false
    if (/(카드|체크|\(\d{3,4}\)|\d{4}\s*(승인|취소))/.test(l)) return false
    return !!clean(l)
  }
  if (dateLine >= 0) {
    const tail = lines[dateLine].replace(/.*\d{1,2}\/\d{1,2}\s*(\d{1,2}:\d{2})?/, '').trim()
    const after = lines.slice(dateLine + 1).find(isPlain)
    res.merchant = after ? clean(after) : clean(tail)
  }
  if (!res.merchant) {
    const before = lines.slice(0, Math.max(amountLine, dateLine, 0)).reverse().find(isPlain)
    res.merchant = before ? clean(before) : ''
  }

  if (!res.amount) res.reason = '금액을 찾지 못했어요'
  else if (!res.month) res.reason = '날짜를 찾지 못했어요'
  else res.ok = true
  return res
}

// 문자 속 카드 → 설정의 결제수단 이름으로 매칭 (없으면 새 이름 제안)
export function matchPayment(parsed, payments = []) {
  const keys = parsed.card === 'KB국민' ? ['KB', '국민'] : parsed.card ? [parsed.card] : []
  const cands = payments.filter((p) => keys.some((k) => p.includes(k)))
  const byType = cands.find((p) => (parsed.check ? /체크/.test(p) : !/체크/.test(p)))
  if (byType || cands[0]) return byType || cands[0]
  if (!parsed.card) return ''
  return `${parsed.card}${parsed.check ? '체크' : '카드'}`
}

// 과거 내역에서 같은 가맹점(세부사항)에 가장 많이 쓴 분류를 추천
// (가끔 다르게 고친 건 무시하고 다수결. 동점이면 최근 것)
// 반환: { get(merchant) -> { major, minor } | undefined }
export function buildCategoryHints(monthly) {
  const exact = new Map() // 정규화한 가맹점 → Map(분류 → {n, last})
  const loose = new Map() // 괄호 뗀 가맹점 → 같은 구조 (예: '쿠팡(쿠페이)' 기록이 없을 때 '쿠팡'으로)
  let seq = 0
  const add = (map, key, cat) => {
    if (!key) return
    const m = map.get(key) || new Map()
    const o = m.get(cat) || { n: 0, last: 0 }
    o.n += 1; o.last = ++seq
    m.set(cat, o); map.set(key, m)
  }
  for (let mo = 1; mo <= 12; mo++) {
    for (const r of monthly?.[mo]?.rows || []) {
      if (!r.major || r.kind === 'income') continue
      const cat = `${r.major}\u0000${r.minor || ''}`
      add(exact, normMerchant(r.detail), cat)
      add(loose, looseMerchant(r.detail), cat)
    }
  }
  const pick = (m) => {
    if (!m) return undefined
    let best = null
    for (const [cat, o] of m) if (!best || o.n > best.o.n || (o.n === best.o.n && o.last > best.o.last)) best = { cat, o }
    const [major, minor] = best.cat.split('\u0000')
    return { major, minor }
  }
  return {
    get: (merchant) => pick(exact.get(normMerchant(merchant))) || pick(loose.get(looseMerchant(merchant))),
  }
}

export function looseMerchant(s) {
  return normMerchant(s).replace(/\(.*?\)/g, '')
}

export function normMerchant(s) {
  return String(s || '').replace(/\s+/g, '').replace(/(주식회사|\(주\)|㈜)/g, '').toLowerCase()
}
