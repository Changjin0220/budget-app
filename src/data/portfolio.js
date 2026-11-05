// ============================================================
// 구글시트 포트폴리오 스냅샷 (Supabase portfolio_snapshots)
// 시트의 Apps Script(docs/sheet-apps-script.gs)가 하루 한 번 넣어줌.
// ============================================================

function base(cfg) { return cfg.url.replace(/\/+$/, '') }

export async function portfolioLatest(cfg) {
  const res = await fetch(`${base(cfg)}/rest/v1/portfolio_snapshots?select=day,data,updated_at&order=day.desc&limit=1`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`portfolio ${res.status}: ${txt.slice(0, 120)}`)
  }
  const [row] = await res.json()
  return row || null
}

// 증권사·계좌별로 묶기
export function groupByAccount(holdings = []) {
  const map = new Map()
  for (const h of holdings) {
    const label = h.account && h.account !== '일반' ? `${h.broker} ${h.account}` : h.broker
    const g = map.get(label) || { label, cost: 0, value: 0, pnl: 0, items: [] }
    g.cost += h.cost; g.value += h.value; g.pnl += h.pnl; g.items.push(h)
    map.set(label, g)
  }
  return [...map.values()].sort((a, b) => b.value - a.value)
}
