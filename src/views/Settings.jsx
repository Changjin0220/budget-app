import { useState } from 'react'
import { useApp } from '../data/store'
import { Card, useConfirm } from '../components/ui'
import { uid } from '../utils/id'
import { won, parseNum } from '../utils/format'
import { exportProfile, importProfile } from '../data/storage'
import { IconClose, IconTrash, IconCloud, IconDownload, IconUpload, IconRefresh } from '../components/icons'

const SECTION_META = {
  income: { key: 'income', label: '수입', color: '#f2c94c', bg: 'var(--gold-100)' },
  saving: { key: 'saving', label: '저축', color: '#7fccbd', bg: 'var(--mint-100)' },
  expense: { key: 'expense', label: '지출', color: '#b3a4e0', bg: 'var(--lav-100)' },
}

function EditableChip({ value, onChange, onRemove }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: '#fff', border: '1px solid var(--line-2)', borderRadius: 20,
      padding: '3px 6px 3px 10px',
    }}>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        style={{ border: 'none', outline: 'none', width: `${Math.max(value.length, 3) + 1}ch`, fontWeight: 600, fontSize: 12.5 }} />
      <button className="btn ghost sm" style={{ padding: '1px 5px', color: 'var(--ink-3)' }} onClick={onRemove} title="삭제"><IconClose size={11} /></button>
    </span>
  )
}

function CategorySection({ sectionKey }) {
  const { state, mutate } = useApp()
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
      right={<button className="chip-btn" onClick={addGroup}>＋ 대분류 추가</button>}>
      <div style={{ display: 'grid', gap: 10 }}>
        {groups.map((g, gi) => (
          <div key={g.id} style={{
            display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12, alignItems: 'start',
            padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--line)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input value={g.name} onChange={(e) => renameGroup(gi, e.target.value)}
                className="input" style={{ fontWeight: 800, background: meta.bg, border: `1px solid ${meta.color}55` }} />
              <button className="btn ghost sm" style={{ color: 'var(--ink-3)' }} onClick={() => removeGroup(gi)} title="대분류 삭제"><IconTrash size={13} /></button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
              {g.subs.map((s, si) => (
                <EditableChip key={s.id} value={s.name} onChange={(v) => renameSub(gi, si, v)} onRemove={() => removeSub(gi, si)} />
              ))}
              <button className="chip-btn" onClick={() => addSub(gi)}>＋ 소분류</button>
            </div>
          </div>
        ))}
      </div>
      {confirmDialog}
    </Card>
  )
}

function PaymentsCard() {
  const { state, mutate } = useApp()
  const [confirm, confirmDialog] = useConfirm()
  const pays = state.settings.payments
  const removePayment = async (i) => {
    if (!(await confirm(`"${pays[i]}" 결제수단을 삭제할까요?`))) return
    mutate((d) => { d.settings.payments.splice(i, 1) })
  }
  return (
    <Card title="결제수단" dot="#a5c8f0"
      right={<button className="chip-btn" onClick={() => mutate((d) => d.settings.payments.push('새 결제수단'))}>＋ 추가</button>}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {pays.map((p, i) => (
          <EditableChip key={i} value={p}
            onChange={(v) => mutate((d) => { d.settings.payments[i] = v })}
            onRemove={() => removePayment(i)} />
        ))}
      </div>
      {confirmDialog}
    </Card>
  )
}

function SyncCard() {
  const { syncConfig, updateSyncConfig, syncStatus, syncError, testConnection, manualSync, showToast } = useApp()
  const [url, setUrl] = useState(syncConfig.url || '')
  const [key, setKey] = useState(syncConfig.key || '')
  const [testing, setTesting] = useState(false)
  const [guide, setGuide] = useState(false)

  const enabled = syncConfig.enabled
  const toggle = () => {
    if (!enabled && (!url.trim() || !key.trim())) { showToast('URL과 anon key를 입력하세요'); return }
    updateSyncConfig({ enabled: !enabled, url: url.trim(), key: key.trim() })
    showToast(!enabled ? '클라우드 동기화를 켰어요' : '클라우드 동기화를 껐어요')
  }
  const saveKeys = () => { updateSyncConfig({ ...syncConfig, url: url.trim(), key: key.trim() }); showToast('저장했어요') }
  const test = async () => {
    setTesting(true)
    try { await testConnection({ enabled: true, url: url.trim(), key: key.trim() }); showToast('연결 성공!') }
    catch (e) { showToast('연결 실패: ' + (e.message || e)) }
    finally { setTesting(false) }
  }

  const statusText = { syncing: '동기화 중…', synced: '동기화됨', error: '오류: ' + syncError, idle: '대기', offline: '오프라인' }[syncStatus] || '대기'

  return (
    <Card title={<><IconCloud size={15} />클라우드 동기화 (부부 공유)</>} dot="#7fccbd"
      right={<button className={`btn ${enabled ? 'primary' : ''}`} onClick={toggle}>{enabled ? '켜짐 · 끄기' : '켜기'}</button>}>
      <p className="helper" style={{ marginTop: 0 }}>
        두 사람이 <b>같은 Supabase URL·key</b>를 넣으면, 어느 기기에서 입력해도 데이터가 자동으로 공유돼요.
        (무료 · 최초 1회 설정) <button className="btn ghost sm" onClick={() => setGuide((v) => !v)}>{guide ? '설정법 접기' : '설정법 보기'}</button>
      </p>
      {guide && (
        <ol style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.7, background: 'var(--surface-2)', padding: '12px 12px 12px 30px', borderRadius: 10 }}>
          <li><b>supabase.com</b> 가입 → 새 프로젝트 생성 (부부가 하나만 공유)</li>
          <li>왼쪽 <b>SQL Editor</b>에 아래 붙여넣고 실행:
            <pre style={{ whiteSpace: 'pre-wrap', background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: 8, marginTop: 4 }}>{`create table budgets (
  profile text primary key,
  data jsonb,
  updated_at timestamptz default now()
);
alter table budgets enable row level security;
create policy "app all" on budgets
  for all using (true) with check (true);`}</pre>
          </li>
          <li><b>Project Settings → API</b>에서 <b>Project URL</b>과 <b>anon public key</b> 복사 → 아래 입력 → <b>연결 테스트</b> → <b>켜기</b></li>
          <li>배우자 기기에서도 같은 URL·key 입력 후 켜면 끝!</li>
        </ol>
      )}
      <div style={{ display: 'grid', gap: 12, marginTop: 6 }}>
        <div className="field">
          <label>Supabase Project URL</label>
          <input className="input" placeholder="https://xxxx.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="field">
          <label>anon public key</label>
          <input className="input" placeholder="eyJhbGci..." value={key} onChange={(e) => setKey(e.target.value)} type="password" />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn" onClick={test} disabled={testing || !url || !key}>{testing ? '확인 중…' : '연결 테스트'}</button>
          <button className="btn" onClick={saveKeys}>키 저장</button>
          {enabled && <button className="btn gold" onClick={manualSync}><IconRefresh size={13} />지금 동기화</button>}
          <span className="helper">상태: {statusText}</span>
        </div>
      </div>
      <div className="helper" style={{ marginTop: 10 }}>
        ※ 저장 방식은 <b>마지막 저장 우선(last-write-wins)</b>이에요. 같은 프로필을 두 기기에서 동시에 편집하면 나중 저장이 반영됩니다.
      </div>
    </Card>
  )
}

export default function Settings() {
  const { state, mutate, profile, showToast, replaceState } = useApp()
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
            <input className="input" type="number" value={s.year}
              onChange={(e) => mutate((d) => { d.settings.year = Number(e.target.value) || d.settings.year })} />
          </div>
          <div className="field">
            <label>가계부 시작일 (매월 며칠부터)</label>
            <input className="input" type="number" min="1" max="28" value={s.startDay}
              onChange={(e) => mutate((d) => { d.settings.startDay = Number(e.target.value) || 1 })} />
          </div>
          <div className="field">
            <label>연간 목표 저축액</label>
            <input className="input text-right" value={s.yearGoalSaving === '' ? '' : Number(s.yearGoalSaving).toLocaleString('ko-KR')}
              onChange={(e) => mutate((d) => { d.settings.yearGoalSaving = parseNum(e.target.value) || 0 })} />
          </div>
        </div>
      </Card>

      <CategorySection sectionKey="income" />
      <CategorySection sectionKey="saving" />
      <CategorySection sectionKey="expense" />
      <PaymentsCard />
      <SyncCard />

      <Card title="데이터 백업 / 복원" dot="#f2a98f">
        <p className="helper" style={{ marginTop: 0 }}>
          지금은 데이터가 이 기기에만 저장돼요. 다른 기기(배우자 폰 등)로 옮기려면 백업 파일을 내보낸 뒤 그 기기에서 가져오면 됩니다.
          <br />추후 클라우드 동기화를 붙이면 이 과정 없이 자동 공유됩니다.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={doExport}><IconDownload size={14} />백업 내보내기</button>
          <label className="btn"><IconUpload size={14} />백업 가져오기
            <input type="file" accept="application/json" style={{ display: 'none' }} onChange={doImport} />
          </label>
        </div>
      </Card>
    </div>
  )
}
