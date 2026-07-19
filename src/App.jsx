import { useState } from 'react'
import { useApp } from './data/store'
import { PROFILES } from './data/defaults'
import ProfileGate from './components/ProfileGate'
import Dashboard from './views/Dashboard'
import Monthly from './views/Monthly'
import Annual from './views/Annual'
import Fixed from './views/Fixed'
import Installment from './views/Installment'
import Assets from './views/Assets'
import Settings from './views/Settings'
import { RemindersBell } from './components/Reminders'
import { IconCloud, IconSwap, IconSave, IconMenu } from './components/icons'

const NAV = [
  { id: 'dashboard', label: '대시보드', crumb: '한눈에 보는 이번 달' },
  { id: 'monthly', label: '월간내역', crumb: '데일리 내역 · 예산' },
  { id: 'annual', label: '연간', crumb: '1년 흐름 & 집계' },
  { id: 'fixed', label: '고정내역', crumb: '매달 반복되는 항목' },
  { id: 'installment', label: '할부', crumb: '카드 할부 관리' },
  { id: 'assets', label: '자산', crumb: '순자산 흐름' },
  { id: 'settings', label: '설정', crumb: '분류 · 결제수단 · 목표' },
]

const VIEWS = {
  dashboard: Dashboard, monthly: Monthly, annual: Annual,
  fixed: Fixed, installment: Installment, assets: Assets, settings: Settings,
}

function SyncBadge() {
  const { syncConfig, syncStatus } = useApp()
  if (!syncConfig?.enabled) return null
  const map = {
    syncing: { t: '동기화 중…', c: 'var(--lav-600)', bg: 'var(--lav-100)' },
    synced: { t: '동기화됨', c: '#2f8574', bg: 'var(--mint-100)' },
    error: { t: '동기화 오류', c: 'var(--minus)', bg: '#fdeef1' },
    idle: { t: '대기', c: 'var(--ink-3)', bg: 'var(--surface-2)' },
    offline: { t: '오프라인', c: 'var(--ink-3)', bg: 'var(--surface-2)' },
  }
  const s = map[syncStatus] || map.idle
  return <span className="pill" style={{ background: s.bg, color: s.c, display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconCloud size={12} />{s.t}</span>
}

export default function App() {
  const { profile, state, setProfile } = useApp()
  const [view, setView] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)

  if (!profile || !state) return <ProfileGate />

  const me = PROFILES.find((p) => p.id === profile) || PROFILES[0]
  const active = NAV.find((n) => n.id === view) || NAV[0]
  const View = VIEWS[view]

  const go = (id) => { setView(id); setMenuOpen(false) }

  return (
    <div className="app-shell">
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">₩</div>
          <div>
            <div className="brand-title">우리집 가계부</div>
            <div className="brand-sub">{state.settings.year}년 · 창진 &amp; 효연</div>
          </div>
        </div>

        <button className="profile-chip" onClick={() => setProfile(null)} title="프로필 전환">
          <span className="profile-avatar" style={{ background: me.color }}>{me.name[0]}</span>
          <span className="who">{me.name} 님</span>
          <span className="swap"><IconSwap size={13} />전환</span>
        </button>

        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.id} className={`nav-item ${view === n.id ? 'active' : ''}`} onClick={() => go(n.id)}>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot"><IconSave size={13} />이 기기에 자동 저장됨</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setMenuOpen(true)}><IconMenu size={20} /></button>
          <div className="topbar-title">
            <h1>{active.label}</h1>
          </div>
          <span className="crumb crumb-sub" style={{ marginLeft: 4 }}>· {active.crumb}</span>
          <div className="topbar-spacer" />
          <SyncBadge />
          <RemindersBell />
          <span className="crumb" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="profile-avatar" style={{ background: me.color, width: 24, height: 24, fontSize: 11 }}>{me.name[0]}</span>
            {me.name}
          </span>
        </header>
        <div className="content">
          <View />
        </div>
      </div>
    </div>
  )
}
