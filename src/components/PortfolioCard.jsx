import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../data/store'
import { cloudEnabled } from '../data/cloud'
import { portfolioLatest, groupByAccount } from '../data/portfolio'
import { Card, MonthPicker } from './ui'
import { num, pct } from '../utils/format'
import { uid } from '../utils/id'
import { IconRefresh } from './icons'

const tone = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '')
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${num(Math.abs(v))}`

// 구글시트가 보내준 증권 계좌 평가액을 보여주고, 원하는 달의 '투자자산'에 반영
export default function PortfolioCard() {
  const { syncConfig, isCommon, mutate, showToast } = useApp()
  const on = cloudEnabled(syncConfig)
  const [snap, setSnap] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState('')
  const [m, setM] = useState(() => new Date().getMonth() + 1)

  const load = useCallback(async () => {
    if (!on) return
    setLoading(true)
    try { setSnap(await portfolioLatest(syncConfig)); setErr('') }
    catch (e) { setErr(/404|42P01|PGRST205/.test(String(e.message)) ? 'no-table' : String(e.message || e)) }
    finally { setLoading(false) }
  }, [on, syncConfig])
  useEffect(() => { load() }, [load])

  const groups = useMemo(() => groupByAccount(snap?.data?.holdings), [snap])
  const total = snap?.data?.total || { cost: 0, value: 0, pnl: 0 }

  if (!on || err === 'no-table') return null

  const apply = () => {
    mutate((d) => {
      let g = d.assets.groups.find((x) => x.type === '투자자산')
      if (!g) { g = { id: uid('ag'), type: '투자자산', rows: [] }; d.assets.groups.push(g) }
      for (const a of groups) {
        let row = g.rows.find((r) => r.name === a.label)
        if (!row) { row = { id: uid('a'), name: a.label, values: Array(12).fill('') }; g.rows.push(row) }
        row.values[m - 1] = a.value
      }
    })
    showToast(`${m}월 투자자산에 ${groups.length}개 계좌를 반영했어요`)
  }

  const when = snap ? new Date(snap.updated_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <Card title="증권 계좌 (구글시트 연동)" dot="#f2c94c" right={
      <button className="btn ghost sm" onClick={load} disabled={loading} title="다시 불러오기"><IconRefresh size={13} />{when && <span className="helper">{when}</span>}</button>
    }>
      {!snap && !err && <div className="helper">아직 시트에서 받은 평가액이 없어요. 시트 메뉴 '가계부 → 지금 가계부로 보내기'를 눌러주세요.</div>}
      {err && <div className="helper neg">{err}</div>}
      {snap && (
        <>
          <div className="pf-total">
            <div><div className="helper">평가금액</div><div className="pf-big num">{num(total.value)}</div></div>
            <div><div className="helper">투자원금</div><div className="num" style={{ fontWeight: 800 }}>{num(total.cost)}</div></div>
            <div><div className="helper">평가손익</div>
              <div className={`num ${tone(total.pnl)}`} style={{ fontWeight: 800 }}>
                {signed(total.pnl)} <span style={{ fontSize: 12 }}>({pct(total.cost ? total.pnl / total.cost : 0, 1)})</span>
              </div>
            </div>
          </div>
          <div className="pf-list">
            {groups.map((a) => (
              <div key={a.label}>
                <button className="pf-row" onClick={() => setOpen(open === a.label ? '' : a.label)}>
                  <span style={{ fontWeight: 800 }}>{a.label}<span className="helper"> · {a.items.length}종목</span></span>
                  <span style={{ textAlign: 'right' }}>
                    <span className="num" style={{ fontWeight: 800 }}>{num(a.value)}</span>
                    <span className={`num ${tone(a.pnl)}`} style={{ display: 'block', fontSize: 11.5 }}>
                      {signed(a.pnl)} ({pct(a.cost ? a.pnl / a.cost : 0, 1)})
                    </span>
                  </span>
                </button>
                {open === a.label && a.items.map((h) => (
                  <div key={h.name} className="pf-item">
                    <span>{h.name}<span className="helper"> {num(h.qty)}주</span></span>
                    <span className="num" style={{ textAlign: 'right' }}>
                      {num(h.value)}
                      <span className={tone(h.pnl)} style={{ display: 'block', fontSize: 11 }}>{pct(h.rate, 1)}</span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {!isCommon && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              <MonthPicker value={m} onChange={setM} />
              <button className="btn primary sm" onClick={apply} disabled={!groups.length}>이 달 투자자산에 반영</button>
              <span className="helper">계좌 이름으로 줄을 찾아 금액을 채워요 (없으면 새로 만듦)</span>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
