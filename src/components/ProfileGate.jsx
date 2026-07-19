import { useApp } from '../data/store'
import { PROFILES } from '../data/defaults'
import { IconArrowRight } from './icons'
import './profileGate.css'

export default function ProfileGate() {
  const { setProfile } = useApp()
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-mark">₩</div>
        <h1>우리집 가계부</h1>
        <p className="gate-sub">함께 쓰고 함께 모으는 부부 가계부</p>
        <div className="gate-who">누구세요?</div>
        <div className="gate-profiles">
          {PROFILES.map((p) => (
            <button key={p.id} className="gate-profile" onClick={() => setProfile(p.id)}
              style={{ '--pc': p.color }}>
              <span className="gp-avatar" style={{ background: p.color }}>{p.name[0]}</span>
              <span className="gp-name">{p.name}</span>
              <span className="gp-go">들어가기<IconArrowRight size={13} /></span>
            </button>
          ))}
        </div>
        <div className="gate-foot">데이터는 이 기기에 안전하게 저장돼요 · 추후 클라우드 동기화 예정</div>
      </div>
    </div>
  )
}
