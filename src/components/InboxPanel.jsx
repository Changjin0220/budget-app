import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../data/store'
import { cloudEnabled } from '../data/cloud'
import { inboxFetch, inboxMark } from '../data/inbox'
import { parseCardSms, matchPayment, buildCategoryHints, normMerchant } from '../data/smsParser'
import { MajorSelect, MinorSelect } from './fields'
import { Card } from './ui'
import { uid } from '../utils/id'
import { num } from '../utils/format'

// 아이폰 단축어로 들어온 카드 승인 문자를 확인 후 월간내역에 반영하는 카드
export default function InboxPanel() {
  const { state, mutate, showToast, isCommon, profile, syncConfig } = useApp()
  const [items, setItems] = useState([])   // [{ id, body, received_at, parsed, major, minor, payment }]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(true)
  const on = !isCommon && cloudEnabled(syncConfig)

  const hints = useMemo(() => buildCategoryHints(state.monthly), [state.monthly])

  const load = useCallback(async () => {
    if (!on) return
    setLoading(true); setError('')
    try {
      const rows = await inboxFetch(syncConfig, profile)
      setItems(rows.map((r) => {
        const parsed = parseCardSms(r.body, r.received_at)
        const hint = hints.get(normMerchant(parsed.merchant)) || {}
        return {
          ...r, parsed,
          major: hint.major || '', minor: hint.minor || '',
          payment: matchPayment(parsed, state.settings.payments),
        }
      }))
    } catch (e) {
      // inbox 테이블이 아직 없으면 조용히 숨김
      setError(/404|42P01|does not exist/.test(String(e.message)) ? 'no-table' : String(e.message || e))
      setItems([])
    } finally { setLoading(false) }
    // hints/payments는 최초 추천에만 쓰므로 의존성에서 제외(입력 중 목록 초기화 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, syncConfig, profile])

  useEffect(() => {
    load()
    if (!on) return
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load, on])

  if (!on || error === 'no-table' || (!items.length && !error)) return null

  const patch = (id, p) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)))

  const apply = async (list) => {
    const good = list.filter((x) => x.parsed.ok)
    if (!good.length) return
    mutate((d) => {
      for (const x of good) {
        const p = x.parsed
        if (x.payment && !d.settings.payments.includes(x.payment)) d.settings.payments.push(x.payment)
        const memo = [p.cancel ? '승인취소' : '', p.installment ? `${p.installment}개월 할부` : '', '문자자동']
          .filter(Boolean).join(' · ')
        d.monthly[p.month].rows.push({
          id: uid('mr'), day: p.day, kind: 'expense',
          major: x.major, minor: x.minor,
          amount: p.cancel ? -p.amount : p.amount,
          payment: x.payment, detail: p.merchant, memo,
          source: `sms:${x.id}`,
        })
      }
    })
    try {
      await inboxMark(syncConfig, good.map((x) => x.id), 'done')
      setItems((xs) => xs.filter((x) => !good.some((g) => g.id === x.id)))
      showToast(`${good.length}건을 월간내역에 넣었어요`)
    } catch (e) { showToast('반영은 했지만 처리표시 실패: ' + (e.message || e)) }
  }

  const skip = async (x) => {
    try { await inboxMark(syncConfig, [x.id], 'skip'); setItems((xs) => xs.filter((y) => y.id !== x.id)) }
    catch (e) { showToast('실패: ' + (e.message || e)) }
  }

  const paymentOptions = (cur) => Array.from(new Set([...(state.settings.payments || []), cur].filter(Boolean)))

  return (
    <Card title={`문자 자동 수집 ${items.length}건`} dot="#7fccbd"
      right={<div style={{ display: 'flex', gap: 8 }}>
        <button className="btn sm ghost" onClick={() => setOpen((v) => !v)}>{open ? '접기' : '펼치기'}</button>
        <button className="btn sm" onClick={load} disabled={loading}>{loading ? '확인 중…' : '새로고침'}</button>
        <button className="btn sm primary" onClick={() => apply(items)} disabled={!items.some((x) => x.parsed.ok)}>모두 반영</button>
      </div>}>
      {error && <div className="helper" style={{ color: '#c0392b' }}>불러오기 실패: {error}</div>}
      {open && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>날짜</th><th>가맹점</th><th>금액</th><th>결제수단</th><th>대분류</th><th>소분류</th><th /></tr></thead>
            <tbody>
              {items.map((x) => {
                const p = x.parsed
                return (
                  <tr key={x.id}>
                    {p.ok ? <>
                      <td>{p.month}/{p.day} {p.time}</td>
                      <td>{p.merchant || '-'}{p.cancel && <span className="pill" style={{ marginLeft: 6 }}>취소</span>}</td>
                      <td className="num">{p.cancel ? '-' : ''}{num(p.amount)}</td>
                      <td>
                        <select className="select" value={x.payment} onChange={(e) => patch(x.id, { payment: e.target.value })}>
                          <option value="">-</option>
                          {paymentOptions(x.payment).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td><MajorSelect value={x.major} onChange={(v) => patch(x.id, { major: v, minor: '' })} /></td>
                      <td><MinorSelect major={x.major} value={x.minor} onChange={(v) => patch(x.id, { minor: v })} /></td>
                    </> : (
                      <td colSpan={6} title={x.body}>
                        <span className="helper">해석 실패({p.reason}): </span>{x.body.slice(0, 60)}
                      </td>
                    )}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {p.ok && <button className="btn sm" onClick={() => apply([x])}>반영</button>}
                      <button className="btn sm ghost" onClick={() => skip(x)}>무시</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="helper" style={{ marginTop: 8 }}>문자 날짜 기준 월에 들어가요. 가맹점별 분류는 예전에 입력한 내역을 보고 추천해요.</div>
    </Card>
  )
}
