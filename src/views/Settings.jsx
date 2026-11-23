import { useState } from 'react'
import { useAuth } from '../components/AuthGate'
import { signOutAndClear } from '../data/auth'
import { useApp, ensureShape } from '../data/store'
import { Card, useConfirm } from '../components/ui'
import { uid } from '../utils/id'
import { won, parseNum } from '../utils/format'
import { exportProfile, importProfile, loadState } from '../data/storage'
import { PROFILES } from '../data/defaults'
import { syncCategoryLists } from '../data/merge'
import { IconClose, IconTrash, IconCloud, IconDownload, IconUpload, IconRefresh } from '../components/icons'

const SECTION_META = {
  income: { key: 'income', label: '수입', color: '#f2c94c', bg: 'var(--gold-100)' },
  saving: { key: 'saving', label: '저축', color: '#7fccbd', bg: 'var(--mint-100)' },
  expense: { key: 'expense', label: '지출', color: '#b3a4e0', bg: 'var(--lav-100)' },
}

function EditableChip({ value, onChange, onRemove, disabled }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: '#fff', border: '1px solid var(--line-2)', borderRadius: 20,
      padding: '3px 6px 3px 10px',
    }}>
      <input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        style={{ border: 'none', outline: 'none', width: `${Math.max(value.length, 3) + 1}ch`, fontWeight: 600, fontSize: 12.5 }} />
      <button className="btn ghost sm" style={{ padding: '1px 5px', color: 'var(--ink-3)' }} onClick={onRemove} title="삭제" disabled={disabled}><IconClose size={11} /></button>
    </span>
  )
}

function CategorySection({ sectionKey }) {
  const { state, mutate, isCommon } = useApp()
  const [confirm, confirmDialog] = useConfirm()
  const meta = SECTION_META[sectionKey]
  const groups = state.settings[sectionKey]

  const addGroup = () => mutate((d) => {
    d.settings[sectionKey].push({ id: uid('g'), name: '새 대분류', subs: [] })
  })
  const renameGroup = (gi, name) => mutate((d) => { d.settings[sectionKey][gi].name = name })
  const removeGroup = async (gi) => {
    if (!(await confirm(`"${groups[gi].name}" 대분류를 삭제할까요? 이미 입력된 내역의 분류명은 그대로 남아있어요.`))) return
    mutate((d) => { d.settings[sectionKey].splice(gi, 1) })
  }
  const addSub = (gi) => mutate((d) => { d.settings[sectionKey][gi].subs.push({ id: uid('s'), name: '새 항목' }) })
  const renameSub = (gi, si, name) => mutate((d) => { d.settings[sectionKey][gi].subs[si].name = name })
  const removeSub = async (gi, si) => {
    if (!(await confirm(`"${groups[gi].subs[si].name}" 소분류를 삭제할까요?`))) return
    mutate((d) => { d.settings[sectionKey][gi].subs.splice(si, 1) })
  }

  return (
    <Card title={`${meta.label} 분류`} dot={meta.color}
      right={<button className="chip-btn" onClick={addGroup} disabled={isCommon}>＋ 대분류 추가</button>}>
      <div style={{ display: 'grid', gap: 10 }}>
        {groups.map((g, gi) => (
          <div key={g.id} style={{
            display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12, alignItems: 'start',
            padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--line)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input value={g.name} onChange={(e) => renameGroup(gi, e.target.value)} disabled={isCommon}
                className="input" style={{ fontWeight: 800, background: meta.bg, border: `1px solid ${meta.color}55` }} />
              <button className="btn ghost sm" style={{ color: 'var(--ink-3)' }} onClick={() => removeGroup(gi)} title="대분류 삭제" disabled={isCommon}><IconTrash size={13} /></button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
              {g.subs.map((s, si) => (
                <EditableChip key={s.id} value={s.name} onChange={(v) => renameSub(gi, si, v)} onRemove={() => removeSub(gi, si)} disabled={isCommon} />
              ))}
              <button className="chip-btn" onClick={() => addSub(gi)} disabled={isCommon}>＋ 소분류</button>
            </div>
          </div>
        ))}
      </div>
      {confirmDialog}
    </Card>
  )
}

function PaymentsCard() {
  const { state, mutate, isCommon } = useApp()
  const [confirm, confirmDialog] = useConfirm()
  const pays = state.settings.payments
  const removePayment = async (i) => {
    if (!(await confirm(`"${pays[i]}" 결제수단을 삭제할까요?`))) return
    mutate((d) => { d.settings.payments.splice(i, 1) })
  }
  return (
    <Card title="결제수단" dot="#a5c8f0"
      right={<button className="chip-btn" onClick={() => mutate((d) => d.settings.payments.push('새 결제수단'))} disabled={isCommon}>＋ 추가</button>}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {pays.map((p, i) => (
          <EditableChip key={i} value={p}
            onChange={(v) => mutate((d) => { d.settings.payments[i] = v })}
            onRemove={() => removePayment(i)} disabled={isCommon} />
        ))}
      </div>
      {confirmDialog}
    </Card>
  )
}

function SyncCategoriesCard() {
  const { profile, isCommon, mutate, showToast } = useApp()
  if (isCommon) return null
  const other = PROFILES.find((p) => p.id !== profile)
  if (!other) return null

  const syncFromOther = () => {
    const raw = loadState(other.id)
    if (!raw) { showToast(`${other.name} 프로필에는 아직 데이터가 없어요`); return }
    const otherSettings = ensureShape(raw).settings
    mutate((d) => {
      const synced = syncCategoryLists(d.settings, otherSettings)
      d.settings.income = synced.income
      d.settings.saving = synced.saving
      d.settings.expense = synced.expense
      d.settings.payments = synced.payments
    })
    showToast(`${other.name}의 카테고리·결제수단을 가져와 합쳤어요`)
  }

  return (
    <Card title="배우자와 카테고리 맞추기" dot="#f2a98f">
      <p className="helper" style={{ marginTop: 0 }}>
        이제 대분류/소분류나 결제수단을 추가·삭제·수정할 때마다 <b>{other.name}</b> 쪽에도 자동으로 맞춰져요(내 목록을 지우지 않는 안전한 합치기).
        이 버튼은 이 기능이 생기기 전부터 있던 예전 차이를 한 번에 맞출 때만 쓰면 돼요.
      </p>
      <button className="btn primary" onClick={syncFromOther}><IconRefresh size={14} />{other.name}의 목록 지금 한 번 가져와 합치기</button>
    </Card>
  )
}

function AccountCard() {
  const { syncStatus, syncError, manualSync, showToast } = useApp()
  const auth = useAuth()
  const statusText = { syncing: '동기화 중…', synced: '동기화됨', error: '오류: ' + syncError, idle: '대기', offline: '오프라인' }[syncStatus] || '대기'
  const copy = async () => {
    try { await navigator.clipboard.writeText(auth.inviteCode); showToast('초대코드를 복사했어요') }
    catch { showToast('초대코드: ' + auth.inviteCode) }
  }
  const logout = async () => { await signOutAndClear(); window.location.reload() }
  return (
    <Card title={<><IconCloud size={15} />계정 · 함께 쓰는 사람</>} dot="#7fccbd">
      <div style={{ display: 'grid', gap: 10, fontSize: 13.5 }}>
        <div><span className="helper">로그인</span> <b>{auth.email}</b> · 가계부 이름 <b>{auth.householdName}</b> · 내 이름 <b>{auth.myProfile}</b></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="helper">초대코드</span>
          <b style={{ letterSpacing: 2, fontSize: 16 }}>{auth.inviteCode}</b>
          <button className="btn sm" onClick={copy}>복사</button>
          <span className="helper">같이 쓸 사람이 가입한 뒤 이 코드를 넣으면 같은 가계부를 봐요</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn gold sm" onClick={manualSync}><IconRefresh size={13} />지금 동기화</button>
          <span className="helper">상태: {statusText}</span>
          <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={logout}>로그아웃</button>
        </div>
      </div>
    </Card>
  )
}

export default function Settings() {
  const { state, mutate, profile, isCommon, showToast, replaceState } = useApp()
  const s = state.settings
  const [importOpen, setImportOpen] = useState(false)

  const doExport = () => {
    const text = exportProfile(profile)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `가계부백업_${profile}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('백업 파일을 내보냈어요')
  }
  const doImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const st = importProfile(profile, reader.result)
        replaceState(st)
        showToast('백업을 가져왔어요')
      } catch { showToast('가져오기 실패: 파일을 확인하세요') }
    }
    reader.readAsText(file)
  }

  return (
    <div className="grid" style={{ maxWidth: 1100 }}>
      <Card title="기본 설정" dot="#8b7ad6">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
          <div className="field">
            <label>연도</label>
            <input className="input" type="number" value={s.year} disabled={isCommon}
              onChange={(e) => mutate((d) => { d.settings.year = Number(e.target.value) || d.settings.year })} />
          </div>
          <div className="field">
            <label>가계부 시작일 (매월 며칠부터)</label>
            <input className="input" type="number" min="1" max="28" value={s.startDay} disabled={isCommon}
              onChange={(e) => mutate((d) => { d.settings.startDay = Number(e.target.value) || 1 })} />
          </div>
          <div className="field">
            <label>연간 목표 저축액{isCommon && <span className="helper"> (창진+효연 합산)</span>}</label>
            <input className="input text-right" value={s.yearGoalSaving === '' ? '' : Number(s.yearGoalSaving).toLocaleString('ko-KR')} disabled={isCommon}
              onChange={(e) => mutate((d) => { d.settings.yearGoalSaving = parseNum(e.target.value) || 0 })} />
          </div>
        </div>
      </Card>

      <CategorySection sectionKey="income" />
      <CategorySection sectionKey="saving" />
      <CategorySection sectionKey="expense" />
      <PaymentsCard />
      <SyncCategoriesCard />
      <AccountCard />

      <Card title="데이터 백업 / 복원" dot="#f2a98f">
        <p className="helper" style={{ marginTop: 0 }}>
          {isCommon
            ? '공통 보기는 창진+효연을 그때그때 합쳐서 보여주는 화면이라 자체 백업이 없어요. 백업은 창진 또는 효연 프로필로 전환해서 이용해주세요.'
            : <>지금은 데이터가 이 기기에만 저장돼요. 다른 기기(배우자 폰 등)로 옮기려면 백업 파일을 내보낸 뒤 그 기기에서 가져오면 됩니다.
              <br />추후 클라우드 동기화를 붙이면 이 과정 없이 자동 공유됩니다.</>}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={doExport} disabled={isCommon}><IconDownload size={14} />백업 내보내기</button>
          <label className="btn" style={isCommon ? { opacity: .5, pointerEvents: 'none' } : undefined}><IconUpload size={14} />백업 가져오기
            <input type="file" accept="application/json" style={{ display: 'none' }} onChange={doImport} disabled={isCommon} />
          </label>
        </div>
      </Card>
    </div>
  )
}
