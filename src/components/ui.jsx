import { useEffect } from 'react'
import { MONTHS } from '../utils/format'
import { IconClose, IconCalendar } from './icons'

export function Card({ title, dot, right, children, className = '', pad = true, style }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || right) && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '15px 18px 0' }}>
          {title && <div className="card-title">{dot && <span className="dot" style={{ background: dot }} />}{title}</div>}
          <div style={{ flex: 1 }} />
          {right}
        </div>
      )}
      <div className={pad ? 'card-pad' : ''}>{children}</div>
    </section>
  )
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 760 } : undefined}>
        <div className="modal-head">
          <h3>{title}</h3>
          <div style={{ flex: 1 }} />
          <button className="btn ghost sm" onClick={onClose}><IconClose size={14} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function MonthPicker({ value, onChange, label = '월 선택' }) {
  return (
    <div className="month-select" title={label}>
      <span style={{ display: 'flex', color: 'var(--ink-3)', paddingLeft: 4 }}><IconCalendar size={15} /></span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {MONTHS.map((m) => <option key={m} value={m}>{m}월</option>)}
      </select>
    </div>
  )
}

export function SectionTitle({ children, sub }) {
  return (
    <div style={{ margin: '4px 0 12px' }}>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{children}</div>
      {sub && <div className="helper" style={{ marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function Confirm({ msg, onOk, onCancel }) {
  return (
    <Modal title="확인" onClose={onCancel}
      footer={<>
        <button className="btn" onClick={onCancel}>취소</button>
        <button className="btn danger primary" style={{ background: 'var(--minus)', borderColor: 'var(--minus)' }} onClick={onOk}>삭제</button>
      </>}>
      <p style={{ margin: 0 }}>{msg}</p>
    </Modal>
  )
}
