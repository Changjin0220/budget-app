// 두 프로필(창진/효연)의 데이터를 "공통" 보기용으로 합침 — 읽기 전용
// 각 행에는 _owner를 붙여서(누가 입력한 항목인지) 화면에 표시할 수 있게 함

function tag(list, owner) {
  return (list || []).map((r) => ({ ...r, _owner: owner }))
}

function mergeCategoryGroups(groupsA, groupsB) {
  const out = (groupsA || []).map((g) => ({ ...g, subs: [...g.subs] }))
  for (const gb of (groupsB || [])) {
    const match = out.find((g) => g.name === gb.name)
    if (match) {
      for (const sb of gb.subs) {
        if (!match.subs.some((s) => s.name === sb.name)) match.subs.push({ ...sb })
      }
    } else {
      out.push({ ...gb, subs: [...gb.subs] })
    }
  }
  return out
}

function mergeSettings(a, b) {
  return {
    ...a,
    income: mergeCategoryGroups(a.income, b.income),
    saving: mergeCategoryGroups(a.saving, b.saving),
    expense: mergeCategoryGroups(a.expense, b.expense),
    payments: Array.from(new Set([...(a.payments || []), ...(b.payments || [])])),
    yearGoalSaving: (Number(a.yearGoalSaving) || 0) + (Number(b.yearGoalSaving) || 0),
  }
}

function mergeMonthly(a, b, ownerA, ownerB) {
  const out = {}
  for (let m = 1; m <= 12; m++) {
    const ma = a[m] || { rows: [], budgets: {}, targets: {}, checklist: [] }
    const mb = b[m] || { rows: [], budgets: {}, targets: {}, checklist: [] }
    const budgets = { ...ma.budgets }
    for (const [k, v] of Object.entries(mb.budgets || {})) {
      budgets[k] = (Number(budgets[k]) || 0) + (Number(v) || 0)
    }
    out[m] = {
      rows: [...tag(ma.rows, ownerA), ...tag(mb.rows, ownerB)],
      budgets,
      targets: { ...ma.targets, ...mb.targets },
      checklist: [...tag(ma.checklist, ownerA), ...tag(mb.checklist, ownerB)],
    }
  }
  return out
}

function mergeAssets(a, b, ownerA, ownerB) {
  const groups = (a.groups || []).map((g) => ({ ...g, rows: tag(g.rows, ownerA) }))
  for (const gb of (b.groups || [])) {
    const match = groups.find((g) => g.type === gb.type)
    if (match) match.rows = [...match.rows, ...tag(gb.rows, ownerB)]
    else groups.push({ ...gb, rows: tag(gb.rows, ownerB) })
  }
  return { groups }
}

export function mergeStates(stateA, ownerA, stateB, ownerB) {
  return {
    version: stateA.version,
    settings: mergeSettings(stateA.settings, stateB.settings),
    fixed: [...tag(stateA.fixed, ownerA), ...tag(stateB.fixed, ownerB)],
    monthly: mergeMonthly(stateA.monthly, stateB.monthly, ownerA, ownerB),
    installments: [...tag(stateA.installments, ownerA), ...tag(stateB.installments, ownerB)],
    loans: [...tag(stateA.loans, ownerA), ...tag(stateB.loans, ownerB)],
    assets: mergeAssets(stateA.assets, stateB.assets, ownerA, ownerB),
  }
}
