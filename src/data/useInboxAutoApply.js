import { useCallback, useEffect, useRef } from 'react'
import { useApp } from './store'
import { cloudEnabled } from './cloud'
import { inboxFetch, inboxMark, pushInboxRows } from './inbox'
import { parseCardSms, matchPayment, buildCategoryHints } from './smsParser'
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
      const auto = []
      for (const r of rows) {
        const parsed = parseCardSms(r.body, r.received_at)
        if (!parsed.ok || parsed.cancel) continue
        const h = hints.exact(parsed.merchant)
        if (!h?.major) continue
        auto.push({ id: r.id, parsed, major: h.major, minor: h.minor, payment: matchPayment(parsed, s.settings.payments), auto: true })
      }
      if (!auto.length) return
      mutate((d) => { pushInboxRows(d, auto, () => uid('mr')) })
      await inboxMark(syncConfig, auto.map((x) => x.id), 'done')
      window.dispatchEvent(new Event(INBOX_CHANGED))
      showToast(`문자 ${auto.length}건을 자동으로 반영했어요`)
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
