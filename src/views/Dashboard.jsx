import { useState, useMemo } from 'react'
import { useApp } from '../data/store'
import { Card, MonthPicker } from '../components/ui'
import { DonutChart, BarV, BarH } from '../components/charts'
import { monthTotals, byMajor, byMinor, topN } from '../data/selectors'
import { won, MONTH_EN } from '../utils/format'
import { RemindersCard } from '../components/Reminders'

export default function Dashboard() {
  const { state } = useApp()
  const [m, setM] = useState(() => new Date().getMonth() + 1)
  const year = state.settings.year
  const rows = state.monthly[m].rows

  const t = useMemo(() => monthTotals(rows), [rows])
  const net = t.totalIncome - t.totalExpense // 저축액(저축+잔여현금)
  const rate = t.totalIncome > 0 ? net / t.totalIncome : 0

  const incTop = useMemo(() => topN(byMinor(rows, 'income'), 5), [rows])
  const expMajorTop = useMemo(() => topN(byMajor(rows, 'expense'), 5), [rows])
  const expMinorTop = useMemo(() => topN(byMinor(rows, 'expense'), 10), [rows])

  const donut = [
    { name: '저축액', value: Math.max(net, 0), color: '#f2c94c' },
    { name: '지출', value: t.totalExpense, color: '#e7e4ee' },
  ]

  return (
    <div className="grid">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>{year} · {MONTH_EN[m - 1]}</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Monthly Summary</div>
        </div>
        <div style={{ flex: 1 }} />
        <MonthPicker value={m} onChange={setM} />
      </div>

      {/* 저축률 + 수입 top5 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,360px) 1fr', gap: 16 }} className="db-top">
        <Card title="저축률" dot="#f2c94c">
          <DonutChart data={donut} height={220}
            centerTop="저축률"
            centerMain={`${Math.round(rate * 100)}%`}
            centerSub={<span style={{ color: net >= 0 ? 'var(--plus)' : 'var(--minus)' }}>{net >= 0 ? '+' : ''}{won(net)}</span>} />
          <table className="tbl" style={{ marginTop: 8, border: 'none' }}>
            <tbody>
              <tr><td style={{ border: 'none', fontWeight: 700 }}>저축액</td><td className="r num" style={{ border: 'none', fontWeight: 800 }}>{won(net)}</td></tr>
              <tr><td style={{ border: 'none', fontWeight: 700 }}>저축률</td><td className="r num" style={{ border: 'none', fontWeight: 800 }}>{Math.round(rate * 100)}%</td></tr>
            </tbody>
          </table>
        </Card>

        <Card title="수입 대분류 top 5" dot="#f2c94c">
          {incTop.length ? <BarV data={incTop} height={250} colorful /> : <div className="empty">수입 내역을 입력하면 표시돼요</div>}
        </Card>
      </div>

      {/* 지출 대분류 top5 + 소분류 top10 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,420px) 1fr', gap: 16 }} className="db-bottom">
        <Card title="지출 대분류 top 5" dot="#b3a4e0">
          {expMajorTop.length ? <BarV data={expMajorTop} height={280} colorful /> : <div className="empty">지출 내역을 입력하면 표시돼요</div>}
        </Card>
        <Card title="지출 소분류 top 10" dot="#c9c2ec">
          {expMinorTop.length ? <BarH data={expMinorTop} height={340} /> : <div className="empty">지출 내역을 입력하면 표시돼요</div>}
        </Card>
      </div>

      <RemindersCard days={14} />

      <div className="helper" style={{ textAlign: 'center' }}>
        상단 우측에서 월을 선택하면 해당 월의 저축률 · 수입/지출 요약을 볼 수 있어요.
      </div>
    </div>
  )
}
