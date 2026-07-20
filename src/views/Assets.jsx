import { useMemo, useState, Fragment } from 'react'
import { useApp } from '../data/store'
import { Card } from '../components/ui'
import { AssetBar, MiniTrend, StackedComposition } from '../components/charts'
import { won, num, MONTHS } from '../utils/format'
import { uid } from '../utils/id'
import { parseNum } from '../utils/format'
import { IconTrash } from '../components/icons'
import { LoanModal, LoanList } from '../components/LoanModal'
import { ensureLoanCategories } from '../data/loans'

const TYPE_TONE = {
  비유동자산: { bg: 'var(--gold-100)', color: '#c9a94c' },
  투자자산: { bg: 'var(--gold-100)', color: '#e9b429' },
  현금자산: { bg: 'var(--gold-100)', color: '#d9a441' },
  부채: { bg: 'var(--lav-100)', color: '#8b7ad6' },
}

export default function Assets() {
  const { state, mutate, showToast } = useApp()
  const groups = state.assets.groups
  const loans = state.loans || []
  const [loanModal, setLoanModal] = useState(null) // null | 'new' | loan object

  const saveLoan = (draft) => {
    mutate((d) => {
      const cats = ensureLoanCategories(d.settings)
      const toSave = { ...draft, ...cats }
      const idx = d.loans.findIndex((x) => x.id === toSave.id)
      if (idx >= 0) d.loans[idx] = toSave
      else d.loans.push(toSave)
    })
    showToast('대출을 저장하고 반영했어요')
    setLoanModal(null)
  }
  const removeLoan = (id) => mutate((d) => { d.loans = d.loans.filter((x) => x.id !== id) })

  const monthlySum = (type) => MONTHS.map((_, i) => {
    const g = groups.find((x) => x.type === type)
    if (!g) return 0
    return g.rows.reduce((a, r) => a + (Number(r.values[i]) || 0), 0)
  })

  const nonCurrent = useMemo(() => monthlySum('비유동자산'), [groups])
  const invest = useMemo(() => monthlySum('투자자산'), [groups])
  const cash = useMemo(() => monthlySum('현금자산'), [groups])
  const debt = useMemo(() => monthlySum('부채'), [groups])

  const totalAsset = MONTHS.map((_, i) => nonCurrent[i] + invest[i] + cash[i])
  const netWorth = MONTHS.map((_, i) => totalAsset[i] - debt[i])
  const netChange = MONTHS.map((_, i) => (i === 0 ? 0 : netWorth[i] - netWorth[i - 1]))

  const trend = (arr) => MONTHS.map((m, i) => ({ month: `${m}`, value: arr[i] }))
  const netBar = MONTHS.map((m, i) => ({ month: `${m}월`, value: netWorth[i] }))
  const composition = MONTHS.map((m, i) => ({
    month: `${m}월`, 비유동자산: nonCurrent[i], 투자자산: invest[i], 현금자산: cash[i], 부채: debt[i],
  }))

  const setVal = (gi, ri, mi, v) => mutate((d) => { d.assets.groups[gi].rows[ri].values[mi] = v })
  const setName = (gi, ri, v) => mutate((d) => { d.assets.groups[gi].rows[ri].name = v })
  const addRow = (gi) => mutate((d) => d.assets.groups[gi].rows.push({ id: uid('a'), name: '새 항목', values: Array(12).fill('') }))
  const rmRow = (gi, ri) => mutate((d) => d.assets.groups[gi].rows.splice(ri, 1))

  return (
    <div className="grid">
      {/* 상단 미니 추이 + 순자산 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr) 1.4fr', gap: 16 }} className="as-top">
        <Card title="비유동자산 추이" dot="#c9c2ec"><MiniTrend data={trend(nonCurrent)} color="#c9c2ec" /></Card>
        <Card title="투자자산 추이" dot="#f2c94c"><MiniTrend data={trend(invest)} color="#f2c94c" /></Card>
        <Card title="순자산 추이" dot="#a8ddd5"><AssetBar data={netBar} height={180} /></Card>
        <Card title="현금자산 추이" dot="#f7db8a"><MiniTrend data={trend(cash)} color="#f7db8a" /></Card>
        <Card title="부채 추이" dot="#b3a4e0"><MiniTrend data={trend(debt)} color="#b3a4e0" /></Card>
        <Card title="자산 구성" dot="#8b7ad6"><StackedComposition data={composition} height={180} /></Card>
      </div>

      {/* 자산 입력 매트릭스 */}
      <Card title="월별 자산 입력" dot="#8b7ad6" right={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className="helper">전세보증금·연금 등 큰 자산까지 매달 기록하면 순자산 흐름이 보여요</span>
          <button className="btn primary sm" onClick={() => setLoanModal('new')}>＋ 주택 추가하기</button>
        </div>
      }>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ minWidth: 84 }}>대분류</th>
                <th style={{ minWidth: 120 }}>소분류</th>
                {MONTHS.map((m) => <th key={m} className="r" style={{ minWidth: 96 }}>{m}월</th>)}
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, gi) => {
                const tone = TYPE_TONE[g.type] || TYPE_TONE.비유동자산
                const gsum = MONTHS.map((_, i) => g.rows.reduce((a, r) => a + (Number(r.values[i]) || 0), 0))
                return (
                  <Fragment key={g.id}>
                    {g.rows.map((r, ri) => (
                      <tr key={r.id}>
                        {ri === 0 && (
                          <td rowSpan={g.rows.length} style={{ fontWeight: 800, verticalAlign: 'top', background: tone.bg, color: tone.color }}>
                            {g.type}
                            <div><button className="chip-btn" style={{ marginTop: 6, padding: '3px 8px', fontSize: 11 }} onClick={() => addRow(gi)}>＋ 항목</button></div>
                          </td>
                        )}
                        <td><input className="input" value={r.name} onChange={(e) => setName(gi, ri, e.target.value)} /></td>
                        {MONTHS.map((_, mi) => (
                          <td key={mi}>
                            <input className="input text-right" style={{ padding: '5px 6px', minWidth: 84 }}
                              value={r.values[mi] === '' || r.values[mi] === undefined ? '' : Number(r.values[mi]).toLocaleString('ko-KR')}
                              onChange={(e) => setVal(gi, ri, mi, parseNum(e.target.value))} />
                          </td>
                        ))}
                        <td><button className="btn ghost sm danger" onClick={() => rmRow(gi, ri)}><IconTrash size={14} /></button></td>
                      </tr>
                    ))}
                    <tr className="sec-total" style={{ background: tone.bg }}>
                      <td colSpan={2} style={{ fontWeight: 800 }}>{g.type} 합계</td>
                      {gsum.map((v, i) => <td key={i} className="r num" style={{ fontWeight: 700 }}>{won(v)}</td>)}
                      <td></td>
                    </tr>
                  </Fragment>
                )
              })}
              {/* 총자산 / 순자산 / 증감 */}
              <tr style={{ background: 'var(--mint-100)' }}>
                <td colSpan={2} style={{ fontWeight: 800 }}>총자산</td>
                {totalAsset.map((v, i) => <td key={i} className="r num" style={{ fontWeight: 800 }}>{won(v)}</td>)}
                <td></td>
              </tr>
              <tr style={{ background: 'var(--lav-100)' }}>
                <td colSpan={2} style={{ fontWeight: 900 }}>순자산</td>
                {netWorth.map((v, i) => <td key={i} className="r num" style={{ fontWeight: 900 }}>{won(v)}</td>)}
                <td></td>
              </tr>
              <tr>
                <td colSpan={2} style={{ fontWeight: 700, color: 'var(--ink-2)' }}>순자산 증감액</td>
                {netChange.map((v, i) => (
                  <td key={i} className="r num" style={{ color: v > 0 ? 'var(--plus)' : v < 0 ? 'var(--warn)' : 'var(--ink-3)', fontWeight: 700 }}>
                    {i === 0 ? '-' : (v > 0 ? '▲' : v < 0 ? '▼' : '-')}{v !== 0 && i !== 0 ? Math.abs(v).toLocaleString('ko-KR') : ''}
                  </td>
                ))}
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <LoanList loans={loans} onEdit={(ln) => setLoanModal(ln)} onRemove={removeLoan} />
      </Card>

      {loanModal && (
        <LoanModal
          initial={loanModal === 'new' ? null : loanModal}
          onSave={saveLoan}
          onClose={() => setLoanModal(null)}
        />
      )}
    </div>
  )
}
