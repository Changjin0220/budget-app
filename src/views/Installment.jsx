import { useApp } from '../data/store'
import { Card, useConfirm } from '../components/ui'
import { MajorSelect, MinorSelect, PaymentSelect, HolidaySelect, AmountInput } from '../components/fields'
import { newInstallment, installmentOccurrences, monthlyAmounts } from '../data/installments'
import { won, num } from '../utils/format'
import { IconUndo, IconTrash } from '../components/icons'

export default function Installment() {
  const { state, mutate, showToast } = useApp()
  const rows = state.installments
  const year = state.settings.year
  const [confirm, confirmDialog] = useConfirm()

  const add = () => mutate((d) => d.installments.push(newInstallment()))
  const patch = (i, key, v) => mutate((d) => {
    d.installments[i][key] = v
    if (key === 'major') d.installments[i].minor = ''
  })
  const remove = async (i) => {
    if (!(await confirm('이 할부 내역을 삭제할까요?'))) return
    mutate((d) => d.installments.splice(i, 1))
  }
  const reset = (i) => mutate((d) => {
    const id = d.installments[i].id
    d.installments[i] = { ...newInstallment(), id }
    showToast('행을 초기화했어요')
  })
  const total = rows.reduce((a, r) => a + (Number(r.total) || 0), 0)

  return (
    <div className="grid">
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>할부 관리</div>
            <div className="helper" style={{ marginTop: 2 }}>할부 정보를 입력하면 <b>월간내역 → 할부 불러오기</b>로 상환일·휴일옵션에 맞춰 매달 자동 반영돼요. (납부회차 자동 표시)</div>
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn primary" onClick={add}>＋ 할부 추가</button>
        </div>

        <div className="tbl-wrap">
          <table className="tbl compact">
            <thead>
              <tr>
                <th className="c" style={{ minWidth: 44 }}>적용</th>
                <th className="c" style={{ minWidth: 38 }}>완료</th>
                <th style={{ minWidth: 84 }}>대분류</th>
                <th style={{ minWidth: 84 }}>소분류</th>
                <th className="r" style={{ minWidth: 84 }}>총금액</th>
                <th style={{ minWidth: 84 }}>결제수단</th>
                <th style={{ minWidth: 64 }}>시작(연.월)</th>
                <th className="c" style={{ minWidth: 48 }}>상환일</th>
                <th style={{ minWidth: 84 }}>휴일옵션</th>
                <th className="c" style={{ minWidth: 44 }}>개월</th>
                <th className="c" style={{ minWidth: 50 }}>연이율%</th>
                <th className="c" style={{ minWidth: 64 }} title="부분 무이자 할부시 고객 부담 개월 수">무이자<br />제외개월</th>
                <th style={{ minWidth: 100 }}>세부사항</th>
                <th style={{ minWidth: 84 }}>비고</th>
                <th style={{ minWidth: 90 }}>회차/월 상환액</th>
                <th style={{ width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={16}><div className="empty">할부 내역이 없어요. <b>＋ 할부 추가</b>로 카드 할부를 등록하면 월간내역에 자동으로 채워져요.</div></td></tr>
              )}
              {rows.map((it, i) => {
                const amounts = monthlyAmounts(it)
                const per = amounts[0]
                const occThisYear = installmentOccurrences(it, year)
                return (
                  <tr key={it.id} style={it.apply ? undefined : { opacity: .5 }}>
                    <td className="c">
                      <button className={`btn sm ${it.apply ? 'primary' : ''}`} style={{ padding: '3px 6px' }}
                        onClick={() => patch(i, 'apply', !it.apply)}>{it.apply ? '적용' : '해제'}</button>
                    </td>
                    <td className="c"><input type="checkbox" checked={it.done} onChange={(e) => patch(i, 'done', e.target.checked)} style={{ width: 15, height: 15 }} /></td>
                    <td><MajorSelect value={it.major} onChange={(v) => patch(i, 'major', v)} /></td>
                    <td><MinorSelect major={it.major} value={it.minor} onChange={(v) => patch(i, 'minor', v)} /></td>
                    <td><AmountInput value={it.total} onChange={(v) => patch(i, 'total', v)} /></td>
                    <td><PaymentSelect value={it.payment} onChange={(v) => patch(i, 'payment', v)} /></td>
                    <td><input className="input" placeholder="2026.1" value={it.startYM} onChange={(e) => patch(i, 'startYM', e.target.value)} /></td>
                    <td className="c"><input className="input" style={{ width: 36, textAlign: 'center' }} type="number" min="1" max="31" value={it.payday} onChange={(e) => patch(i, 'payday', e.target.value)} /></td>
                    <td><HolidaySelect value={it.holiday} onChange={(v) => patch(i, 'holiday', v)} /></td>
                    <td className="c"><input className="input" style={{ width: 36, textAlign: 'center' }} type="number" min="1" value={it.months} onChange={(e) => patch(i, 'months', e.target.value)} /></td>
                    <td className="c"><input className="input" style={{ width: 40, textAlign: 'center' }} value={it.rate} onChange={(e) => patch(i, 'rate', e.target.value)} placeholder="0" /></td>
                    <td className="c"><input className="input" style={{ width: 40, textAlign: 'center' }} type="number" min="0" value={it.partialFree} onChange={(e) => patch(i, 'partialFree', e.target.value)} placeholder="0" /></td>
                    <td><input className="input" value={it.detail} onChange={(e) => patch(i, 'detail', e.target.value)} placeholder="예: PT" /></td>
                    <td><input className="input" value={it.memo} onChange={(e) => patch(i, 'memo', e.target.value)} /></td>
                    <td className="num" style={{ fontSize: 11.5 }}>
                      {amounts.length
                        ? <><b>{it.months}회</b> · {won(per)}/회{occThisYear.length ? <div className="helper">{year}년 {occThisYear.length}회 반영</div> : <div className="helper">{year}년 해당 없음</div>}</>
                        : <span className="helper">개월·금액 입력</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="btn ghost sm" style={{ padding: '3px 5px' }} onClick={() => reset(i)} title="행 초기화"><IconUndo size={13} /></button>
                        <button className="btn ghost sm danger" style={{ padding: '3px 5px' }} onClick={() => remove(i)}><IconTrash size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="sec-total" style={{ background: 'var(--surface-2)' }}>
                  <td colSpan={4} style={{ fontWeight: 800 }}>합계</td>
                  <td className="r num" style={{ fontWeight: 900 }}>{won(total)}</td>
                  <td colSpan={11}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <Card title="이렇게 반영돼요 (예시)" dot="#f2c94c">
        <p className="helper" style={{ marginTop: 0 }}>
          예) 총금액 3,000,000원 · 2개월 할부 · 상환일 14일 · 「휴일 직후 영업일」 → 매달 1,500,000원씩,
          상환일이 주말/공휴일이면 그 이후 첫 영업일에 반영. 월간내역 비고에 <b>(1/2회)</b>, <b>(2/2회)</b> 처럼 납부회차가 자동 표시돼요.
        </p>
      </Card>

      {confirmDialog}
    </div>
  )
}
