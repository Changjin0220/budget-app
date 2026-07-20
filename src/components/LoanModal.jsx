import { useState, useMemo } from 'react'
import { Modal } from './ui'
import { AmountInput, HolidaySelect } from './fields'
import { won, num } from '../utils/format'
import { LOAN_METHODS, loanSchedule, loanSummary, newLoan } from '../data/loans'
import { IconTrash } from './icons'

export function LoanModal({ initial, onSave, onClose }) {
  const [draft, setDraft] = useState(() => (initial ? { ...initial } : newLoan()))
  const set = (key, v) => setDraft((d) => ({ ...d, [key]: v }))

  const schedule = useMemo(() => loanSchedule(draft), [draft])
  const summary = useMemo(() => loanSummary(draft), [draft])
  const valid = schedule.length > 0 && !!String(draft.startYM || '').trim()

  return (
    <Modal title={initial ? '주택담보대출 수정' : '주택 추가하기'} onClose={onClose} wide
      footer={<>
        <button className="btn" onClick={onClose}>취소</button>
        <button className="btn primary" disabled={!valid} onClick={() => onSave(draft)}>계산하고 적용</button>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field">
          <label>이름</label>
          <input className="input" value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label>대출원금</label>
          <AmountInput value={draft.principal} onChange={(v) => set('principal', v)} />
        </div>
        <div className="field">
          <label>대출기간(개월)</label>
          <input className="input" type="number" min="1" value={draft.termMonths} onChange={(e) => set('termMonths', e.target.value)} />
        </div>
        <div className="field">
          <label>거치기간(개월)</label>
          <input className="input" type="number" min="0" value={draft.graceMonths} onChange={(e) => set('graceMonths', e.target.value)} />
        </div>
        <div className="field">
          <label>대출금리(연 %)</label>
          <input className="input" value={draft.ratePercent} onChange={(e) => set('ratePercent', e.target.value)} placeholder="예: 5.16" />
        </div>
        <div className="field">
          <label>대출 시작(연.월)</label>
          <input className="input" placeholder="2026.1" value={draft.startYM} onChange={(e) => set('startYM', e.target.value)} />
        </div>
        <div className="field">
          <label>상환일</label>
          <input className="input" type="number" min="1" max="31" value={draft.payday} onChange={(e) => set('payday', e.target.value)} />
        </div>
        <div className="field">
          <label>휴일옵션</label>
          <HolidaySelect value={draft.holiday} onChange={(v) => set('holiday', v)} />
        </div>
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label>상환방식</label>
        <div className="seg" style={{ flexWrap: 'wrap' }}>
          {LOAN_METHODS.map((m) => (
            <button key={m.id} className={draft.method === m.id ? 'on' : ''} onClick={() => set('method', m.id)}>{m.label}</button>
          ))}
        </div>
      </div>

      {draft.method === 'graduated' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div className="field">
            <label>증액주기(개월)</label>
            <input className="input" type="number" min="1" value={draft.stepMonths} onChange={(e) => set('stepMonths', e.target.value)} />
          </div>
          <div className="field">
            <label>증액률(%, 주기마다 상환액 증가폭)</label>
            <input className="input" value={draft.growthPercent} onChange={(e) => set('growthPercent', e.target.value)} />
          </div>
        </div>
      )}

      {draft.method === 'graduated' && schedule.some((r) => r.principal < 0) && (
        <div className="helper" style={{ marginTop: 10, color: 'var(--warn)' }}>
          증액률이 대출금리보다 낮으면 초반 상환액이 이자보다 적어 원금이 일시적으로 늘어날 수 있어요(역상환). 이 구간은 저축(원금)으로 반영되지 않고 이자만 지출로 반영돼요. 증액률을 높이면 줄어들어요.
        </div>
      )}

      {summary && (
        <div style={{ marginTop: 16 }}>
          <div className="kpi-row">
            <div className="kpi year"><div className="k-label">상환개월</div><div className="k-value">{summary.months}개월</div></div>
            <div className="kpi income"><div className="k-label">{summary.isLevel ? '월상환금' : '1회차 상환금'}</div><div className="k-value num">{won(summary.firstPayment)}</div></div>
            <div className="kpi expense"><div className="k-label">총 이자액</div><div className="k-value num">{won(summary.totalInterest)}</div></div>
            <div className="kpi save"><div className="k-label">원리금 합계</div><div className="k-value num">{won(summary.totalPayment)}</div></div>
          </div>

          <div className="tbl-wrap" style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto' }}>
            <table className="tbl compact">
              <thead>
                <tr>
                  <th className="c">회차</th><th className="r">상환금(원)</th><th className="r">납입원금(원)</th>
                  <th className="r">이자(원)</th><th className="r">납입원금누계(원)</th><th className="r">잔금(원)</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((r) => (
                  <tr key={r.seq}>
                    <td className="c">{r.seq}</td>
                    <td className="r num">{num(r.payment)}</td>
                    <td className="r num">{num(r.principal)}</td>
                    <td className="r num">{num(r.interest)}</td>
                    <td className="r num">{num(r.cumPrincipal)}</td>
                    <td className="r num">{num(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="helper" style={{ marginTop: 8 }}>
            적용하면 매달 <b>{draft.interestMajor} · {draft.interestMinor}</b>(지출)과 <b>{draft.principalMajor} · {draft.principalMinor}</b>(저축)이
            자동으로 계산돼서 고정내역·월간내역에 반영돼요. 실제 시작 연도가 아닌 다른 해에도 시작월 기준으로 자동 계산됩니다.
          </div>
        </div>
      )}
    </Modal>
  )
}

export function LoanList({ loans, onEdit, onRemove }) {
  if (!loans.length) return null
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
      <div style={{ fontWeight: 800, fontSize: 13 }}>연결된 주택담보대출</div>
      {loans.map((ln) => {
        const summary = loanSummary(ln)
        const methodLabel = LOAN_METHODS.find((m) => m.id === ln.method)?.label
        return (
          <div key={ln.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', flexWrap: 'wrap',
            background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12,
          }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 800 }}>{ln.name}</div>
              <div className="helper">
                {won(Number(ln.principal) || 0)} · {methodLabel} · {ln.termMonths}개월 · {ln.startYM} 시작
              </div>
            </div>
            {summary && <div className="helper num" style={{ textAlign: 'right' }}>총이자 {won(summary.totalInterest)}</div>}
            <button className="btn ghost sm" onClick={() => onEdit(ln)}>수정</button>
            <button className="btn ghost sm danger" onClick={() => onRemove(ln.id)}><IconTrash size={14} /></button>
          </div>
        )
      })}
    </div>
  )
}
