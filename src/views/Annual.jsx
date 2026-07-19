import { useMemo, useState, Fragment } from 'react'
import { useApp } from '../data/store'
import { Card } from '../components/ui'
import { DonutChart, MonthlyFlow } from '../components/charts'
import { annualMatrix, byMajor, byMinor, byPayment, monthTotals } from '../data/selectors'
import { won, num, MONTHS } from '../utils/format'
import { PALETTE } from '../data/defaults'

export default function Annual() {
  const { state } = useApp()
  const s = state.settings
  const monthly = state.monthly

  const matrix = useMemo(() => annualMatrix(monthly, s), [monthly, s])

  // 연 합계
  const perMonth = MONTHS.map((m) => monthTotals(monthly[m].rows))
  const incomeTotal = perMonth.reduce((a, t) => a + t.totalIncome, 0)
  const expenseTotal = perMonth.reduce((a, t) => a + t.totalExpense, 0)
  const savingCashTotal = incomeTotal - expenseTotal // 저축/현금
  const goal = Number(s.yearGoalSaving) || 0
  const achieve = goal > 0 ? savingCashTotal / goal : 0

  // 월별흐름도
  const flow = MONTHS.map((m, i) => {
    const t = perMonth[i]
    const sc = t.totalIncome - t.totalExpense
    return {
      month: `${m}월`,
      수입: t.totalIncome,
      '저축/현금': sc,
      지출: t.totalExpense,
      저축률: t.totalIncome > 0 ? sc / t.totalIncome : 0,
    }
  })

  // 전체 rows
  const allRows = MONTHS.flatMap((m) => monthly[m].rows)
  const incomeDonut = toDonut(byMinor(allRows, 'income'), 6)
  const expenseDonut = toDonut(byMajor(allRows, 'expense'), 10)
  const payDonut = toDonut(byPayment(allRows, s.payments), 8)

  const [collapsed, setCollapsed] = useState(() => new Set())
  const toggle = (name) => setCollapsed((prev) => {
    const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n
  })

  const incomeGroups = matrix.filter((g) => g.kind === 'income')
  const savingGroups = matrix.filter((g) => g.kind === 'saving')
  const expenseGroups = matrix.filter((g) => g.kind === 'expense')

  const sectionTot = (groups) => {
    const months = MONTHS.map((_, i) => groups.reduce((a, g) => a + g.months[i], 0))
    const total = months.reduce((a, b) => a + b, 0)
    const nz = months.filter((x) => x !== 0).length
    return { months, total, avg: nz ? total / nz : 0 }
  }
  const incTot = sectionTot(incomeGroups)
  const savTot = sectionTot(savingGroups)
  const leftoverMonths = MONTHS.map((_, i) => perMonth[i].totalIncome - perMonth[i].totalSaving - perMonth[i].totalExpense)

  return (
    <div className="grid">
      {/* 상단 스트립 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }} className="an-strip">
        <div className="kpi year"><div className="k-label">연도</div><div className="k-value">{s.year}</div></div>
        <div className="kpi income"><div className="k-label">수입</div><div className="k-value num">{num(incomeTotal)}</div></div>
        <div className="kpi save"><div className="k-label">저축/현금</div><div className="k-value num">{num(savingCashTotal)}</div></div>
        <div className="kpi expense"><div className="k-label">지출</div><div className="k-value num">{num(expenseTotal)}</div></div>
      </div>

      {/* 달성률 + 월별흐름도 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,320px) 1fr', gap: 16 }} className="an-flow">
        <Card title="목표 저축액 달성률" dot="#f2c94c">
          <DonutChart
            data={[{ name: '달성', value: Math.max(savingCashTotal, 0), color: '#f2c94c' }, { name: '남은목표', value: Math.max(goal - savingCashTotal, 0), color: '#eceaf3' }]}
            height={210} centerMain={`${(achieve * 100).toFixed(1)}%`} />
          <table className="tbl" style={{ marginTop: 8, border: 'none' }}>
            <tbody>
              <tr><td style={{ border: 'none', fontWeight: 700 }}>목표 저축액</td><td className="r num" style={{ border: 'none' }}>{won(goal)}</td></tr>
              <tr><td style={{ border: 'none', fontWeight: 700 }}>달성률</td><td className="r num" style={{ border: 'none', fontWeight: 800 }}>{(achieve * 100).toFixed(1)}%</td></tr>
            </tbody>
          </table>
        </Card>
        <Card title="월별 흐름도" dot="#8b7ad6">
          <MonthlyFlow data={flow} height={320} />
        </Card>
      </div>

      {/* 3 도넛 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }} className="an-donuts">
        <Card title="수입" dot="#f2c94c">
          {incomeDonut.length ? <DonutChart data={incomeDonut} height={230} showLegend /> : <div className="empty">데이터 없음</div>}
        </Card>
        <Card title="지출" dot="#b3a4e0">
          {expenseDonut.length ? <DonutChart data={expenseDonut} height={230} showLegend /> : <div className="empty">데이터 없음</div>}
        </Card>
        <Card title="결제수단" dot="#a5c8f0">
          {payDonut.length ? <DonutChart data={payDonut} height={230} showLegend /> : <div className="empty">데이터 없음</div>}
        </Card>
      </div>

      {/* 집계 매트릭스 */}
      <Card title="대분류 · 소분류별 12개월 집계" dot="#8b7ad6"
        right={<span className="helper">＋/－ 로 소분류 펼치기/접기</span>}>
        <div className="tbl-wrap">
          <table className="tbl an-matrix">
            <thead>
              <tr>
                <th style={{ minWidth: 84 }}>대분류</th>
                <th style={{ minWidth: 96 }}>소분류</th>
                <th className="r" style={{ minWidth: 96 }}>합계</th>
                {MONTHS.map((m) => <th key={m} className="r" style={{ minWidth: 78 }}>{m}월</th>)}
                <th className="r" style={{ minWidth: 84 }}>평균</th>
              </tr>
            </thead>
            <tbody>
              <MatrixSection groups={incomeGroups} sectionTot={incTot} sectionName="수입 합계" tone="income" collapsed={collapsed} toggle={toggle} />
              <MatrixSection groups={savingGroups} sectionTot={savTot} sectionName="저축 합계" tone="save" collapsed={collapsed} toggle={toggle} />
              <tr className="sec-total leftover">
                <td colSpan={2} style={{ fontWeight: 800 }}>잔여현금 합계</td>
                <td className="r num" style={{ fontWeight: 800 }}>{signed(leftoverMonths.reduce((a, b) => a + b, 0))}</td>
                {leftoverMonths.map((v, i) => <td key={i} className="r num">{signed(v)}</td>)}
                <td className="r num">{signed(Math.round(leftoverMonths.reduce((a, b) => a + b, 0) / 12))}</td>
              </tr>
              <MatrixSection groups={expenseGroups} perGroupTotalRow tone="expense" collapsed={collapsed} toggle={toggle} />
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function toDonut(map, n) {
  return Object.entries(map).map(([name, value]) => ({ name, value }))
    .filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, n)
    .map((x, i) => ({ ...x, color: PALETTE[i % PALETTE.length] }))
}
function signed(v) {
  if (!v) return '-'
  return (v < 0 ? '-' : '') + Math.abs(v).toLocaleString('ko-KR')
}

// 섹션 렌더: income/saving은 섹션합계 하단, expense는 그룹별 합계행
function MatrixSection({ groups, sectionTot, sectionName, tone, perGroupTotalRow, collapsed, toggle }) {
  const toneColor = { income: 'var(--gold-100)', save: 'var(--mint-100)', expense: 'var(--gold-100)' }
  return (
    <>
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.name)
        return (
          <Fragment key={g.name}>
            {/* 그룹 헤더 (첫 소분류와 병합 느낌) */}
            {g.subs.map((sub, si) => {
              if (isCollapsed) return null
              return (
                <tr key={sub.name}>
                  {si === 0 && (
                    <td rowSpan={g.subs.length} style={{ fontWeight: 800, verticalAlign: 'top', background: 'var(--surface-2)' }}>
                      <button className="btn ghost sm" style={{ padding: '0 5px', marginRight: 4 }} onClick={() => toggle(g.name)}>－</button>
                      {g.name}
                    </td>
                  )}
                  <td style={{ color: 'var(--ink-2)' }}>{sub.name}</td>
                  <td className="r num" style={{ fontWeight: 700 }}>{won(sub.total)}</td>
                  {sub.months.map((v, i) => <td key={i} className="r num">{won(v)}</td>)}
                  <td className="r num" style={{ color: 'var(--ink-3)' }}>{won(sub.avg)}</td>
                </tr>
              )
            })}
            {isCollapsed && (
              <tr>
                <td style={{ fontWeight: 800, background: 'var(--surface-2)' }}>
                  <button className="btn ghost sm" style={{ padding: '0 5px', marginRight: 4 }} onClick={() => toggle(g.name)}>＋</button>
                  {g.name}
                </td>
                <td className="helper">소분류 접힘</td>
                <td className="r num" style={{ fontWeight: 700 }}>{won(g.total)}</td>
                {g.months.map((v, i) => <td key={i} className="r num">{won(v)}</td>)}
                <td className="r num" style={{ color: 'var(--ink-3)' }}>{won(g.avg)}</td>
              </tr>
            )}
            {perGroupTotalRow && (
              <tr className="sec-total" style={{ background: toneColor[tone] }}>
                <td colSpan={2} style={{ fontWeight: 800 }}>{g.name} 합계</td>
                <td className="r num" style={{ fontWeight: 800 }}>{won(g.total)}</td>
                {g.months.map((v, i) => <td key={i} className="r num" style={{ fontWeight: 700 }}>{won(v)}</td>)}
                <td className="r num" style={{ fontWeight: 700 }}>{won(g.avg)}</td>
              </tr>
            )}
          </Fragment>
        )
      })}
      {sectionTot && (
        <tr className="sec-total" style={{ background: 'var(--lav-100)' }}>
          <td colSpan={2} style={{ fontWeight: 800 }}>{sectionName}</td>
          <td className="r num" style={{ fontWeight: 800 }}>{won(sectionTot.total)}</td>
          {sectionTot.months.map((v, i) => <td key={i} className="r num" style={{ fontWeight: 700 }}>{won(v)}</td>)}
          <td className="r num" style={{ fontWeight: 700 }}>{won(sectionTot.avg)}</td>
        </tr>
      )}
    </>
  )
}
