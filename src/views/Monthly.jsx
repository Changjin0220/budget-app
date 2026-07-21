import { useState, useMemo } from 'react'
import { useApp } from '../data/store'
import { Card, MonthPicker, Modal, useConfirm } from '../components/ui'
import { MajorSelect, MinorSelect, PaymentSelect, AmountInput } from '../components/fields'
import { DonutChart, BarV, DailyLine } from '../components/charts'
import {
  monthTotals, byMajor, byMinor, byPayment, byDaySpend, topN, noSpendDays, kindOf, allMajors,
} from '../data/selectors'
import { won, num, deltaMark, MONTH_EN } from '../utils/format'
import { daysInMonth, resolveBusinessDay } from '../utils/holidays'
import { installmentOccurrences } from '../data/installments'
import { loanOccurrences } from '../data/loans'
import { uid } from '../utils/id'
import { PALETTE } from '../data/defaults'
import { compressImage } from '../utils/image'
import {
  IconDownload, IconUndo, IconSort, IconSearch, IconClose, IconPaperclip,
  IconTrash, IconReceipt,
} from '../components/icons'

function BudgetDot({ color }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6 }} />
}

function newRow(day = 1) {
  return { id: uid('mr'), day, kind: 'expense', major: '', minor: '', amount: '', payment: '', detail: '', memo: '' }
}

// 요약 항목 한 줄
function SummaryRow({ label, value, strong, color, hi }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderBottom: '1px dashed var(--line)',
    }}>
      <span style={{ fontWeight: 700, color: 'var(--ink-2)', fontSize: 13 }}>{label}</span>
      <span className="num" style={{ fontWeight: strong ? 900 : 700, fontSize: strong ? 16 : 14, color: color || 'var(--ink)' }}>
        {hi ? value : (value === 0 ? '-' : num(value))}{typeof value === 'number' ? '' : ''}
      </span>
    </div>
  )
}

export default function Monthly() {
  const { state, mutate, showToast } = useApp()
  const [confirm, confirmDialog] = useConfirm()
  const [m, setM] = useState(() => new Date().getMonth() + 1)
  const year = state.settings.year
  const dim = daysInMonth(year, m)

  const month = state.monthly[m]
  const rows = month.rows
  const prevRows = m > 1 ? state.monthly[m - 1].rows : []

  const totals = useMemo(() => monthTotals(rows), [rows])
  const majors = allMajors(state.settings)
  const expenseBudgets = month.budgets || {}
  const spendBudget = majors.filter((g) => g.kind === 'expense')
    .reduce((a, g) => a + (Number(expenseBudgets[g.name]) || 0), 0)
  const leftBudget = spendBudget - totals.totalExpense

  // 차트 데이터
  const incomeByMinor = useMemo(() => topN(byMinor(rows, 'income'), 8), [rows])
  const expByMajor = useMemo(() => topN(byMajor(rows, 'expense'), 12), [rows])
  const dailySpend = useMemo(() => byDaySpend(rows, dim), [rows, dim])
  const payMap = useMemo(() => byPayment(rows, state.settings.payments), [rows, state.settings.payments])
  const noSpend = noSpendDays(rows, dim)

  // 필터
  const [fMajor, setFMajor] = useState('')
  const [fMinor, setFMinor] = useState('')
  const [fPay, setFPay] = useState('')
  const [fText, setFText] = useState('')
  const filtered = rows.filter((r) => {
    if (fMajor && r.major !== fMajor) return false
    if (fMinor && r.minor !== fMinor) return false
    if (fPay && r.payment !== fPay) return false
    if (fText && !(`${r.detail} ${r.memo} ${r.minor} ${r.major}`).includes(fText)) return false
    return true
  })
  const anyFilter = fMajor || fMinor || fPay || fText
  const filteredTotal = filtered.reduce((a, r) => a + (Number(r.amount) || 0), 0)

  // 행 조작
  const add = () => mutate((d) => d.monthly[m].rows.unshift(newRow()))
  const patch = (id, key, v) => mutate((d) => {
    const row = d.monthly[m].rows.find((r) => r.id === id)
    if (!row) return
    row[key] = v
    if (key === 'major') { row.minor = ''; row.kind = kindOf(d.settings, v) }
  })
  const remove = async (id) => {
    if (!(await confirm('이 내역을 삭제할까요?'))) return
    mutate((d) => { d.monthly[m].rows = d.monthly[m].rows.filter((r) => r.id !== id) })
  }
  const sortByDate = () => mutate((d) => {
    d.monthly[m].rows.sort((a, b) => (Number(a.day) || 0) - (Number(b.day) || 0))
    showToast('날짜순으로 정렬했어요')
  })

  const importFixed = () => mutate((d) => {
    const existingSrc = new Set(
      d.monthly[m].rows.filter((r) => r.source?.startsWith('fixed:') || r.source?.startsWith('loan:')).map((r) => r.source),
    )
    let cnt = 0
    for (const fx of d.fixed) {
      if (!fx.major) continue
      const src = `fixed:${fx.id}`
      if (existingSrc.has(src)) continue
      const kind = kindOf(d.settings, fx.major)
      let { month: rm, day } = resolveBusinessDay(year, m, fx.day, fx.holiday)
      if (rm < m) day = 1
      if (rm > m) day = daysInMonth(year, m)
      d.monthly[m].rows.push({
        id: uid('mr'), day, kind, major: fx.major, minor: fx.minor,
        amount: fx.amount, payment: fx.payment, detail: fx.detail, memo: fx.memo, source: src,
      })
      cnt++
    }
    // 연결된 주택담보대출: 이자(지출) + 원금(저축) 행을 매달 정확한 금액으로 자동 계산해서 반영
    for (const ln of (d.loans || [])) {
      const occ = loanOccurrences(ln, year).filter((o) => o.month === m)
      for (const o of occ) {
        const memo = `(${o.seq}/${o.total}회) ${ln.name}`
        if (o.interest > 0) {
          const src = `loan:${ln.id}#${o.seq}:interest`
          if (!existingSrc.has(src)) {
            d.monthly[m].rows.push({
              id: uid('mr'), day: o.day, kind: kindOf(d.settings, ln.interestMajor), major: ln.interestMajor, minor: ln.interestMinor,
              amount: o.interest, payment: '', detail: '대출이자', memo, source: src,
            })
            cnt++
          }
        }
        if (o.principal > 0) {
          const src = `loan:${ln.id}#${o.seq}:principal`
          if (!existingSrc.has(src)) {
            d.monthly[m].rows.push({
              id: uid('mr'), day: o.day, kind: kindOf(d.settings, ln.principalMajor), major: ln.principalMajor, minor: ln.principalMinor,
              amount: o.principal, payment: '', detail: '대출원금', memo, source: src,
            })
            cnt++
          }
        }
      }
    }
    showToast(cnt ? `고정내역 ${cnt}건을 불러왔어요` : '이미 모두 불러온 상태예요')
  })

  const importInstallments = () => mutate((d) => {
    const existing = new Set(d.monthly[m].rows.filter((r) => r.source?.startsWith('inst:')).map((r) => r.source))
    let cnt = 0
    for (const it of d.installments) {
      if (!it.apply || !it.major) continue
      const occ = installmentOccurrences(it, year)
      for (const o of occ) {
        if (o.month !== m) continue
        const src = `inst:${it.id}#${o.seq}`
        if (existing.has(src)) continue
        d.monthly[m].rows.push({
          id: uid('mr'), day: o.day, kind: kindOf(d.settings, it.major), major: it.major, minor: it.minor,
          amount: o.amount, payment: it.payment, detail: it.detail,
          memo: `(${o.seq}/${o.total}회)${it.memo ? ' ' + it.memo : ''}`, source: src,
        })
        cnt++
      }
    }
    showToast(cnt ? `할부 ${cnt}건을 불러왔어요` : '이번 달 반영할 할부가 없어요')
  })

  const importPrevBudget = () => mutate((d) => {
    if (m === 1) { showToast('1월은 이전 달이 없어요'); return }
    d.monthly[m].budgets = { ...(d.monthly[m - 1].budgets || {}) }
    showToast('전월 예산을 불러왔어요')
  })

  const setBudget = (groupName, v) => mutate((d) => {
    if (!d.monthly[m].budgets) d.monthly[m].budgets = {}
    d.monthly[m].budgets[groupName] = v
  })

  // 체크리스트
  const addCheck = () => mutate((d) => d.monthly[m].checklist.push({ id: uid('ck'), text: '', done: false }))
  const patchCheck = (id, key, v) => mutate((d) => {
    const c = d.monthly[m].checklist.find((x) => x.id === id); if (c) c[key] = v
  })
  const rmCheck = (id) => mutate((d) => { d.monthly[m].checklist = d.monthly[m].checklist.filter((x) => x.id !== id) })

  // 영수증 첨부
  const [viewReceipt, setViewReceipt] = useState(null)
  const attachReceipt = async (id, file) => {
    if (!file) return
    try {
      const dataUrl = await compressImage(file)
      mutate((d) => { const row = d.monthly[m].rows.find((r) => r.id === id); if (row) row.receipt = dataUrl })
      showToast('영수증을 첨부했어요')
    } catch (e) { showToast(String(e.message || e)) }
  }
  const removeReceipt = (id) => mutate((d) => { const row = d.monthly[m].rows.find((r) => r.id === id); if (row) delete row.receipt })

  // 도넛 데이터 (수입 소분류 비중)
  const incomeDonut = incomeByMinor.map((x, i) => ({ ...x, color: PALETTE[i % PALETTE.length] }))

  return (
    <div className="grid">
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{year}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--lav-500)' }}>{MONTH_EN[m - 1]}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="pill" style={{ background: 'var(--lav-100)', color: 'var(--lav-700)' }}>무지출 {noSpend}일</span>
          <MonthPicker value={m} onChange={setM} />
        </div>
      </div>

      {/* 요약 KPI */}
      <div className="kpi-row">
        <div className="kpi income"><div className="k-label">총수입</div><div className="k-value num">{won(totals.totalIncome)}</div></div>
        <div className="kpi expense"><div className="k-label">총지출</div><div className="k-value num">{won(totals.totalExpense)}</div></div>
        <div className="kpi save"><div className="k-label">총저축</div><div className="k-value num">{won(totals.totalSaving)}</div></div>
        <div className="kpi year"><div className="k-label">저축률</div><div className="k-value num">{Math.round(totals.savingRate * 100)}%</div></div>
      </div>

      {/* 좌: 요약+체크리스트 / 우: 차트 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 16, alignItems: 'start' }} className="mo-split">
        <div className="grid">
          <Card title="이달의 요약" dot="#8b7ad6">
            <SummaryRow label="총수입" value={totals.totalIncome} />
            <SummaryRow label="총지출" value={totals.totalExpense} />
            <SummaryRow label="총저축" value={totals.totalSaving} />
            <SummaryRow label="잔여현금" value={totals.leftover} color={totals.leftover < 0 ? 'var(--minus)' : 'var(--plus)'} />
            <SummaryRow label="저축률" value={`${Math.round(totals.savingRate * 100)}%`} hi strong color="var(--lav-600)" />
            <div style={{ height: 8 }} />
            <SummaryRow label="지출예산" value={spendBudget} />
            <SummaryRow label="잔여예산" value={leftBudget} color={leftBudget < 0 ? 'var(--minus)' : 'var(--plus)'} />
            {spendBudget > 0 && (() => {
              const ratio = totals.totalExpense / spendBudget
              const over = ratio > 1
              const near = !over && ratio >= 0.8
              const c = over ? 'var(--minus)' : near ? 'var(--warn)' : 'var(--mint-400)'
              return (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                    <span style={{ color: c, display: 'inline-flex', alignItems: 'center' }}><BudgetDot color={c} />{over ? '예산 초과' : near ? '예산 임박' : '예산 여유'}</span>
                    <span className="num" style={{ color: c }}>{Math.round(ratio * 100)}%</span>
                  </div>
                  <div style={{ height: 9, background: 'var(--line)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(ratio * 100, 100)}%`, height: '100%', background: c, borderRadius: 6, transition: 'width .3s' }} />
                  </div>
                </div>
              )
            })()}
          </Card>

          <Card title="결제수단별 지출" dot="#a5c8f0"
            right={<span className="helper num">합계 {won(totals.totalExpense)}</span>}>
            <table className="tbl" style={{ border: 'none' }}>
              <tbody>
                {state.settings.payments.map((p) => (
                  <tr key={p}><td style={{ border: 'none' }}>{p}</td><td className="r num" style={{ border: 'none' }}>{won(payMap[p])}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="체크리스트" dot="#7fccbd"
            right={<button className="chip-btn" onClick={addCheck}>＋ 추가</button>}>
            {month.checklist.length === 0 && <div className="helper">이달의 목표나 다짐을 적어보세요 (예: 식비 20만원 도전!)</div>}
            <div style={{ display: 'grid', gap: 6 }}>
              {month.checklist.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={c.done} onChange={(e) => patchCheck(c.id, 'done', e.target.checked)} style={{ width: 17, height: 17 }} />
                  <input className="input" value={c.text} placeholder="할 일 / 다짐" onChange={(e) => patchCheck(c.id, 'text', e.target.value)}
                    style={{ textDecoration: c.done ? 'line-through' : 'none', opacity: c.done ? .6 : 1 }} />
                  <button className="btn ghost sm" onClick={() => rmCheck(c.id)}><IconClose size={13} /></button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="mo-charts">
            <Card title="수입" dot="#f2c94c">
              {incomeDonut.length ? (
                <DonutChart data={incomeDonut} height={230} centerMain={won(totals.totalIncome)} centerTop="총수입" showLegend />
              ) : <div className="empty">수입 내역을 입력하면 표시돼요</div>}
            </Card>
            <Card title="지출 (대분류)" dot="#b3a4e0">
              {expByMajor.length ? <BarV data={expByMajor} height={230} colorful /> : <div className="empty">지출 내역을 입력하면 표시돼요</div>}
            </Card>
          </div>
          <Card title="일별 지출" dot="#c9c2ec">
            <DailyLine data={dailySpend} height={200} />
          </Card>
        </div>
      </div>

      {/* 카테고리 목표/예산 대비 */}
      <BudgetTables m={m} rows={rows} prevRows={prevRows} budgets={expenseBudgets} setBudget={setBudget} />

      {/* 데일리 내역 */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>데일리 내역</div>
          <span className="pill" style={{ background: 'var(--lav-100)', color: 'var(--lav-700)' }}>{rows.length}건</span>
          <div style={{ flex: 1 }} />
          <button className="btn gold" onClick={importFixed}><IconDownload size={14} />고정내역 불러오기</button>
          <button className="btn" onClick={importInstallments}><IconDownload size={14} />할부 불러오기</button>
          <button className="btn" onClick={importPrevBudget}><IconUndo size={14} />전월예산 불러오기</button>
          <button className="btn" onClick={sortByDate}><IconSort size={14} />날짜 정렬</button>
          <button className="btn primary" onClick={add}>＋ 행 추가</button>
        </div>

        {/* 필터 바 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center', background: 'var(--surface-2)', padding: 10, borderRadius: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconSearch size={13} />필터</span>
          <MajorSelect value={fMajor} onChange={(v) => { setFMajor(v); setFMinor('') }} style={{ width: 130 }} />
          <MinorSelect major={fMajor} value={fMinor} onChange={setFMinor} style={{ width: 130 }} />
          <PaymentSelect value={fPay} onChange={setFPay} style={{ width: 130 }} />
          <input className="input" style={{ width: 160 }} placeholder="세부사항/비고 검색" value={fText} onChange={(e) => setFText(e.target.value)} />
          {anyFilter && <button className="btn sm ghost" onClick={() => { setFMajor(''); setFMinor(''); setFPay(''); setFText('') }}><IconClose size={12} />필터 해제</button>}
          {anyFilter && <span className="helper">{filtered.length}건 표시</span>}
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 70 }} className="c">날짜</th>
                <th style={{ minWidth: 116 }}>대분류</th>
                <th style={{ minWidth: 116 }}>소분류</th>
                <th style={{ minWidth: 110 }} className="r">금액</th>
                <th style={{ minWidth: 116 }}>결제수단</th>
                <th style={{ minWidth: 180 }}>세부사항</th>
                <th style={{ minWidth: 150 }}>비고</th>
                <th className="c" style={{ width: 54 }}>영수증</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9}><div className="empty">
                  {anyFilter ? '조건에 맞는 내역이 없어요' : '내역이 없어요. 월 초에 「고정내역 불러오기」로 세팅한 뒤 데일리 지출을 입력해보세요!'}
                </div></td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} style={r.source ? { background: 'rgba(242,201,76,.06)' } : undefined}>
                  <td className="c">
                    <input className="input" style={{ width: 54, textAlign: 'center', padding: '6px 4px' }} type="number" min="1" max={dim}
                      value={r.day} onChange={(e) => patch(r.id, 'day', Math.min(Math.max(Number(e.target.value) || 1, 1), dim))} />
                  </td>
                  <td><MajorSelect value={r.major} onChange={(v) => patch(r.id, 'major', v)} /></td>
                  <td><MinorSelect major={r.major} value={r.minor} onChange={(v) => patch(r.id, 'minor', v)} /></td>
                  <td><AmountInput value={r.amount} onChange={(v) => patch(r.id, 'amount', v)} /></td>
                  <td><PaymentSelect value={r.payment} onChange={(v) => patch(r.id, 'payment', v)} /></td>
                  <td><input className="input" value={r.detail} onChange={(e) => patch(r.id, 'detail', e.target.value)} /></td>
                  <td><input className="input" value={r.memo} onChange={(e) => patch(r.id, 'memo', e.target.value)} /></td>
                  <td className="c">
                    {r.receipt
                      ? <button className="btn ghost sm" title="영수증 보기" onClick={() => setViewReceipt(r.id)} style={{ padding: '2px 4px' }}>
                          <img src={r.receipt} alt="영수증" style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line-2)' }} />
                        </button>
                      : <label className="btn ghost sm" title="영수증 첨부" style={{ cursor: 'pointer' }}><IconPaperclip size={14} />
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => attachReceipt(r.id, e.target.files?.[0])} />
                        </label>}
                  </td>
                  <td><button className="btn ghost sm danger" onClick={() => remove(r.id)}><IconTrash size={14} /></button></td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="sec-total" style={{ background: 'var(--surface-2)' }}>
                  <td colSpan={3} style={{ fontWeight: 800 }}>합계</td>
                  <td className="r num" style={{ fontWeight: 900 }}>{won(filteredTotal)}</td>
                  <td colSpan={5}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="helper" style={{ marginTop: 8 }}>노란 배경 행은 고정내역/할부에서 자동으로 불러온 항목이에요. 클립 아이콘으로 영수증 사진을 첨부할 수 있어요.</div>
      </Card>

      {viewReceipt && (() => {
        const r = rows.find((x) => x.id === viewReceipt)
        if (!r?.receipt) return null
        return (
          <Modal title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><IconReceipt size={16} />영수증</span>} onClose={() => setViewReceipt(null)}
            footer={<>
              <button className="btn danger" onClick={() => { removeReceipt(viewReceipt); setViewReceipt(null) }}>삭제</button>
              <button className="btn" onClick={() => setViewReceipt(null)}>닫기</button>
            </>}>
            <div style={{ textAlign: 'center' }}>
              <div className="helper" style={{ marginBottom: 8 }}>{m}/{r.day} · {r.major} · {r.minor} · {won(r.amount)}</div>
              <img src={r.receipt} alt="영수증" style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid var(--line)' }} />
            </div>
          </Modal>
        )
      })()}

      {confirmDialog}
    </div>
  )
}

// ---------- 목표/예산 대비 테이블 ----------
function BudgetTables({ m, rows, prevRows, budgets, setBudget }) {
  const { state } = useApp()
  const majors = allMajors(state.settings)

  const groupTotal = (groupName, kind, src) => src
    .filter((r) => r.major === groupName && r.kind === kind)
    .reduce((a, r) => a + (Number(r.amount) || 0), 0)

  const renderSection = (kind, title, color, budgetLabel) => {
    const groups = majors.filter((g) => g.kind === kind)
    const isExpense = kind === 'expense'
    return (
      <Card title={title} dot={color}>
        <div className="tbl-wrap" style={{ border: 'none' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>대분류</th><th className="r">금액</th>
                <th className="r">{budgetLabel}</th>
                {isExpense && <th style={{ minWidth: 96 }}>사용률</th>}
                <th className="r">{budgetLabel}대비</th>
                <th className="r">전달대비</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const cur = groupTotal(g.name, kind, rows)
                const prev = groupTotal(g.name, kind, prevRows)
                const bud = Number(budgets[g.name]) || 0
                const vsBudget = cur - bud
                const vsPrev = cur - prev
                const dB = deltaMark(vsBudget)
                const dP = deltaMark(vsPrev)
                const ratio = bud > 0 ? cur / bud : 0
                const over = isExpense && bud > 0 && cur > bud
                const near = isExpense && bud > 0 && !over && ratio >= 0.8
                const barColor = over ? 'var(--minus)' : near ? 'var(--warn)' : 'var(--mint-400)'
                return (
                  <tr key={g.name} style={over ? { background: 'rgba(224,82,106,.05)' } : undefined}>
                    <td style={{ fontWeight: 700 }}>
                      {(over || near) && <BudgetDot color={over ? 'var(--minus)' : 'var(--warn)'} />}
                      {g.name}
                    </td>
                    <td className="r num" style={{ color: over ? 'var(--minus)' : undefined, fontWeight: over ? 800 : undefined }}>{won(cur)}</td>
                    <td className="r num">
                      <input className="input text-right" style={{ width: 100, padding: '5px 8px' }}
                        value={bud ? bud.toLocaleString('ko-KR') : ''} placeholder="0"
                        onChange={(e) => setBudget(g.name, Number(String(e.target.value).replace(/[^0-9]/g, '')) || 0)} />
                    </td>
                    {isExpense && (
                      <td>
                        {bud > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 7, background: 'var(--line)', borderRadius: 6, overflow: 'hidden', minWidth: 44 }}>
                              <div style={{ width: `${Math.min(ratio * 100, 100)}%`, height: '100%', background: barColor, borderRadius: 6, transition: 'width .3s' }} />
                            </div>
                            <span className="num" style={{ fontSize: 11, color: over ? 'var(--minus)' : 'var(--ink-3)', minWidth: 30, textAlign: 'right' }}>{Math.round(ratio * 100)}%</span>
                          </div>
                        ) : <span className="helper">-</span>}
                      </td>
                    )}
                    <td className="r num" style={{ color: isExpense ? (vsBudget > 0 ? 'var(--minus)' : 'var(--plus)') : (vsBudget >= 0 ? 'var(--plus)' : 'var(--minus)') }}>{dB.text}</td>
                    <td className="r num" style={{ color: dP.cls === 'up' ? 'var(--warn)' : dP.cls === 'down' ? 'var(--plus)' : 'var(--ink-3)' }}>{dP.text}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="mo-budget">
      <div className="grid">
        {renderSection('income', '수입 · 목표 대비', '#f2c94c', '목표')}
        {renderSection('saving', '저축 · 목표 대비', '#7fccbd', '목표')}
      </div>
      {renderSection('expense', '지출 · 예산 대비', '#b3a4e0', '예산')}
    </div>
  )
}
