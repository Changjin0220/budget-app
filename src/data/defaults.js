import { uid } from '../utils/id'

// 설정1.png 기준 기본 카테고리 시드
function grp(name, subs) {
  return { id: uid('g'), name, subs: subs.map((s) => ({ id: uid('s'), name: s })) }
}

export function defaultSettings(year = 2026) {
  return {
    year,
    startDay: 5,             // 가계부 시작일
    yearGoalSaving: 50000000, // 연간 목표 저축액
    income: [grp('수입', ['월급', '상여금', '블로그', '공모주', '기타'])],
    saving: [grp('저축', ['ISA 월적립', '자동매수', '연금저축펀드', '개별증권계좌', 'A 적금'])],
    expense: [
      grp('주거비', ['월세', '공과금', '관리비', '대출이자']),
      grp('고정비', ['통신비', '보험료', '정기구독', '기타']),
      grp('교통비', ['대중교통', '택시', '주유비', '차량유지비', '주차비']),
      grp('식비', ['장보기', '외식비', '간식/카페', '배달']),
      grp('건강/의료비', ['병원비', '약국/의약품', '영양제', '운동']),
      grp('양육비', ['식비/수유', '용품/위생', '의류/잡화', '놀이/교육']),
      grp('생필품비', ['주방', '세탁/청소', '욕실/위생', '기타']),
      grp('자기계발비', ['도서', '강의', '자격증', '기타 취미']),
      grp('여가비', ['영화', '공연', '게임', '기타 취미']),
      grp('꾸밈비', ['의류', '헤어/네일', '화장품', '잡화']),
      grp('관계비', ['선물', '모임']),
      grp('경조사비', ['축의금', '조의금', '명절', '기타']),
      grp('이벤트성', ['여행', '가전/가구', '기념일', '기타']),
      grp('멍청비용', ['연체료/수수료', '분실/파손 재구매', '충동구매', '환불불가']),
    ],
    payments: ['국민체크', '현대카드', '현금/이체', 'KB 신용카드'],
  }
}

// 자산 기본 구조 (자산시트1~3)
export function defaultAssets() {
  const z = () => Array(12).fill('')
  const row = (name) => ({ id: uid('a'), name, values: z() })
  return {
    groups: [
      { id: uid('ag'), type: '비유동자산', rows: [row('주택청약'), row('연금펀드'), row('전세보증금')] },
      { id: uid('ag'), type: '투자자산', rows: [row('A증권사 국내'), row('B증권사 국내'), row('A증권사 해외'), row('B증권사 해외'), row('ISA'), row('코인')] },
      { id: uid('ag'), type: '현금자산', rows: [row('적금1'), row('적금2'), row('예금1'), row('파킹1'), row('파킹2')] },
      { id: uid('ag'), type: '부채', rows: [row('학자금대출'), row('신용대출'), row('담보대출')] },
    ],
  }
}

export const ASSET_TYPES = ['비유동자산', '투자자산', '현금자산', '부채']

export function emptyMonthly() {
  const m = {}
  for (let i = 1; i <= 12; i++) {
    m[i] = { rows: [], budgets: {}, targets: {}, checklist: [] }
  }
  return m
}

export function defaultState(year = 2026) {
  return {
    version: 1,
    settings: defaultSettings(year),
    fixed: [],
    monthly: emptyMonthly(),
    installments: [],
    loans: [],
    assets: defaultAssets(),
    posts: [],
  }
}

export const PROFILES = [
  { id: '창진', name: '창진', color: '#8b7ad6' },
  { id: '효연', name: '효연', color: '#f0a9bf' },
]

// 창진+효연 데이터를 합산해서 보는 읽기 전용 "가구 전체" 뷰
export const COMMON_ID = '공통'
export const COMMON_PROFILE = {
  id: COMMON_ID, name: '공통', color: '#5bb8a6',
  avatarBg: 'linear-gradient(135deg, #8b7ad6 50%, #f0a9bf 50%)',
}
export const ALL_PROFILES = [...PROFILES, COMMON_PROFILE]

// 카테고리(대분류) 도넛/막대 색상 팔레트 (파스텔)
export const PALETTE = [
  '#b3a4e0', '#f2c94c', '#7fccbd', '#f0a9bf', '#a5c8f0',
  '#f2a98f', '#c9c2ec', '#f7db8a', '#a8ddd5', '#e6b3d4',
  '#9ad0c2', '#f5c98a', '#bfb0e8', '#d4a5c9', '#a9d8b8',
]
