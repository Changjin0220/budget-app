import { useCallback, useEffect, useRef } from 'react'
import { useApp } from './store'
import { cloudEnabled } from './cloud'
import { inboxFetch, inboxMark, pushInboxRows, matchCancels } from './inbox'
import { parseCardSms, matchPayment, buildCategoryHints, normMerchant } from './smsParser'
import { uid } from '../utils/id'

// 예전에 분류해 둔 가맹점의 카드 승인 문자는 확인 없이 바로 월간내역에 넣음.
// 처음 보는 가맹점, 승인취소, 해석 안 되는 문자는 수신함에 남겨 직접 확인.
// 클라우드 최신본을 받은 뒤(synced)에만 돌려서, 옛 내역 위에 덮어쓰는 일이 없게 함.
export const INBOX_CHANGED = 'inbox-changed'

export function useInboxAutoApply() {
  const { state, mutate, isCommon, profile, syncConfig, syncStatus, showToast } = useApp()
  const ready = !!state && !isCommon && cloudEnabled(syncConfig) && syncStatus === 'synced'
  const stateRef = useRef(state)
  stateRef.current = state
  const busy = useRef(false)

  const run = useCallback(async () => {
    if (!ready || busy.current) return
    busy.current = true
    try {
      const rows = await inboxFetch(syncConfig, profile)
      const s = stateRef.current
      const hints = buildCategoryHints(s.monthly)
      const items = rows.map((r) => ({ ...r, parsed: parseCardSms(r.body, r.received_at) }))

      // 승인취소: 짝이 되는 승인(수신함 or 이미 넣은 내역)을 찾아 함께 없앰
      const { pairs, removals } = matchCancels(s, items, normMerchant)
      const handled = new Set([...pairs.flatMap((x) => [x.cancelId, x.pendingId]), ...removals.map((x) => x.cancelId)])

      const auto = []
      for (const x of items) {
        if (handled.has(x.id) || !x.parsed.ok || x.parsed.cancel) continue
        const h = hints.exact(x.parsed.merchant)
        if (!h?.major) continue
        auto.push({ id: x.id, parsed: x.parsed, major: h.major, minor: h.minor, payment: matchPayment(x.parsed, s.settings.payments), auto: true })
      }
      if (!auto.length && !handled.size) return
      const rm = new Set(removals.map((x) => x.rowId))
      mutate((d) => {
        if (rm.size) for (let mo = 1; mo <= 12; mo++) if (d.monthly[mo]) d.monthly[mo].rows = d.monthly[mo].rows.filter((r) => !rm.has(r.id))
        if (auto.length) pushInboxRows(d, auto, () => uid('mr'))
      })
      if (auto.length) await inboxMark(syncConfig, auto.map((x) => x.id), 'done')
      if (handled.size) await inboxMark(syncConfig, [...handled], 'skip')
      window.dispatchEvent(new Event(INBOX_CHANGED))
      const msg = [auto.length ? `${auto.length}건 자동 반영` : '', handled.size ? `승인취소 ${pairs.length + removals.length}건 정리` : '']
      showToast('문자 ' + msg.filter(Boolean).join(', ') + '했어요')
    } catch { /* 다음 기회에 재시도 */ }
    finally { busy.current = false }
  }, [ready, syncConfig, profile, mutate, showToast])

  useEffect(() => {
    if (!ready) return
    run()
    const onFocus = () => run()
    window.addEventListener('focus', onFocus)
    const iv = setInterval(run, 120000)
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv) }
  }, [ready, run])
}
