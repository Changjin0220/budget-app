import { useMemo, useState, Fragment } from 'react'
import { useApp } from '../data/store'
import { Card } from '../components/ui'
import { MajorSelect, MinorSelect, PaymentSelect, HolidaySelect, AmountInput, kindTag } from '../components/fields'
import { kindOf } from '../data/selectors'
import { uid } from '../utils/id'
import { won } from '../utils/format'
import { IconSort, IconTrash, IconChevronDown } from '../components/icons'

const DAY_OPTIONS = [...Array(31)].map((_, i) => String(i + 1)).concat(['말일'])

function newRow() {
  return { id: uid('fx'), major: '', minor: '', day: '1', holiday: '-', amount: '', payment: '', detail: '', memo: '' }
}

// 대분류별 소계 (클릭 시 소분류별 금액 펼침/접힘, 기본은 전부 접힘)
function MajorSubtotals({ rows }) {
  const [open, setOpen] = useState(() => new Set())
  const toggle = (major) => setOpen((prev) => {
    const n = new Set(prev)
    n.has(major) ? n.delete(major) : n.add(major)
    return n
  })

  const groups = useMemo(() => {
    const order = []
    const map = new Map()
    for (const r of rows) {
      if (!r.major) continue
      const amt = Number(r.amount) || 0
      if (!map.has(r.major)) { map.set(r.major, new Map()); order.push(r.major) }
      const minors = map.get(r.major)
      const key = r.minor || '(소분류 없음)'
      minors.set(key, (minors.get(key) || 0) + amt)
    }
    return order.map((major) => {
      const minors = Array.from(map.get(major).entries()).map(([minor, amount]) => ({ minor, amount }))
      const total = minors.reduce((a, m) => a + m.amount, 0)
      return { major, total, minors }
    })
  }, [rows])

  if (groups.length === 0) return null

  return (
    <Card title="대분류별 소계" dot="#8b7ad6">
      <div className="tbl-wrap" style={{ border: 'none' }}>
        <table className="tbl">
          <tbody>
            {groups.map((g) => {
              const isOpen = open.has(g.major)
              return (
                <Fragment key={g.major}>
                  <tr className="subtotal-row" onClick={() => toggle(g.major)}>
                    <td style={{ fontWeight: 800 }}>
                      <span className="subtotal-chevron" style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                        <IconChevronDown size={14} />
                      </span>
                      {g.major}
                    </td>
                    <td className="r num" style={{ fontWeight: 800 }}>{won(g.total)}</td>
                  </tr>
                  {isOpen && g.minors.map((m) => (
                    <tr key={m.minor}>
                      <td style={{ paddingLeft: 34, color: 'var(--ink-2)' }}>{m.minor}</td>
                      <td className="r num" style={{ color: 'var(--ink-2)' }}>{won(m.amount)}</td>
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function Fixed() {
  const { state, mutate } = useApp()
  const rows = state.fixed

  const add = () => mutate((d) => d.fixed.push(newRow()))
  const patch = (i, key, v) => mutate((d) => {
    d.fixed[i][key] = v
    if (key === 'major') d.fixed[i].minor = '' // 대분류 바뀌면 소분류 초기화
  })
  const remove = (i) => mutate((d) => d.fixed.splice(i, 1))
  const sortByDate = () => mutate((d) => {
    const rank = (r) => (r.day === '말일' ? 32 : parseInt(r.day, 10) || 99)
    d.fixed.sort((a, b) => rank(a) - rank(b))
  })
  const total = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0)

  return (
    <div className="grid">
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>고정내역 (정기월급 · 정기저축 · 고정비)</div>
            <div className="helper" style={{ marginTop: 2 }}>한 번 입력해두면 매달 <b>월간내역 → 고정내역 불러오기</b>로 자동 반영돼요.</div>
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={sortByDate}><IconSort size={14} />날짜 정렬</button>
          <button className="btn primary" onClick={add}>＋ 행 추가</button>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ minWidth: 120 }}>대분류</th>
                <th style={{ minWidth: 120 }}>소분류</th>
                <th style={{ minWidth: 84 }} className="c">날짜</th>
                <th style={{ minWidth: 140 }}>휴일 옵션</th>
                <th style={{ minWidth: 120 }} className="r">금액</th>
                <th style={{ minWidth: 120 }}>결제수단</th>
                <th style={{ minWidth: 180 }}>세부사항</th>
                <th style={{ minWidth: 160 }}>비고</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9}><div className="empty">아직 고정내역이 없어요. <b>＋ 행 추가</b>로 매달 반복되는 항목을 등록해보세요.</div></td></tr>
              )}
              {rows.map((r, i) => {
                const kind = r.major ? kindOf(state.settings, r.major) : null
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MajorSelect value={r.major} onChange={(v) => patch(i, 'major', v)} />
                      </div>
                    </td>
                    <td><MinorSelect major={r.major} value={r.minor} onChange={(v) => patch(i, 'minor', v)} /></td>
                    <td className="c">
                      <select className="select" value={r.day} onChange={(e) => patch(i, 'day', e.target.value)}>
                        {DAY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </td>
                    <td><HolidaySelect value={r.holiday} onChange={(v) => patch(i, 'holiday', v)} /></td>
                    <td><AmountInput value={r.amount} onChange={(v) => patch(i, 'amount', v)} /></td>
                    <td><PaymentSelect value={r.payment} onChange={(v) => patch(i, 'payment', v)} /></td>
                    <td><input className="input" value={r.detail} onChange={(e) => patch(i, 'detail', e.target.value)} placeholder="예: 넷플릭스" /></td>
                    <td><input className="input" value={r.memo} onChange={(e) => patch(i, 'memo', e.target.value)} placeholder="비고" /></td>
                    <td><button className="btn ghost sm danger" onClick={() => remove(i)} title="삭제"><IconTrash size={14} /></button></td>
                  </tr>
                )
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="sec-total" style={{ background: 'var(--surface-2)' }}>
                  <td colSpan={4} style={{ fontWeight: 800 }}>합계</td>
                  <td className="r num" style={{ fontWeight: 900 }}>{won(total)}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <MajorSubtotals rows={rows} />

      <Card title="휴일 옵션이 뭔가요?" dot="#f2c94c">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 13, color: 'var(--ink-2)' }}>
          <li><b>휴일 직후 영업일</b> : 지정한 날짜가 주말/공휴일이면, 그 <b>이후 첫 영업일</b>에 빠져나가는 것으로 반영돼요. (예: 자동이체가 밀리는 항목)</li>
          <li><b>휴일 직전 영업일</b> : 날짜가 휴일이면 <b>직전 영업일</b>로 당겨서 반영돼요. (예: 급여가 휴일 전날 지급)</li>
          <li><b>-</b> : 보정 없이 지정 날짜 그대로.</li>
        </ul>
        <div className="helper" style={{ marginTop: 8 }}>한국 공휴일(설·추석 포함)과 주말을 기준으로 계산합니다.</div>
      </Card>
    </div>
  )
}
