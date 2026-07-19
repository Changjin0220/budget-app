import { useApp } from '../data/store'
import { allMajors, subsOf, kindOf } from '../data/selectors'
import { HOLIDAY_OPTIONS } from '../utils/holidays'
import { parseNum } from '../utils/format'

const KIND_STYLE = {
  income: { color: '#a97e13' },
  saving: { color: '#2f8574' },
  expense: { color: '#5f4fa8' },
}

// 대분류 select (수입/저축/지출 그룹으로 optgroup)
export function MajorSelect({ value, onChange, style }) {
  const { state } = useApp()
  const majors = allMajors(state.settings)
  const inc = majors.filter((m) => m.kind === 'income')
  const sav = majors.filter((m) => m.kind === 'saving')
  const exp = majors.filter((m) => m.kind === 'expense')
  return (
    <select className="select" value={value || ''} onChange={(e) => onChange(e.target.value)} style={style}>
      <option value="">대분류</option>
      <optgroup label="── 수입 ──">{inc.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}</optgroup>
      <optgroup label="── 저축 ──">{sav.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}</optgroup>
      <optgroup label="── 지출 ──">{exp.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}</optgroup>
    </select>
  )
}

export function MinorSelect({ major, value, onChange, style }) {
  const { state } = useApp()
  const subs = major ? subsOf(state.settings, major) : []
  return (
    <select className="select" value={value || ''} onChange={(e) => onChange(e.target.value)} style={style} disabled={!major}>
      <option value="">소분류</option>
      {subs.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}

export function PaymentSelect({ value, onChange, style, allowEmpty = true }) {
  const { state } = useApp()
  return (
    <select className="select" value={value || ''} onChange={(e) => onChange(e.target.value)} style={style}>
      {allowEmpty && <option value="">-</option>}
      {state.settings.payments.map((p) => <option key={p} value={p}>{p}</option>)}
    </select>
  )
}

export function HolidaySelect({ value, onChange, style }) {
  return (
    <select className="select" value={value || '-'} onChange={(e) => onChange(e.target.value)} style={style}>
      {HOLIDAY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

export function AmountInput({ value, onChange, style, placeholder = '금액' }) {
  const display = value === '' || value === null || value === undefined ? '' : Number(value).toLocaleString('ko-KR')
  return (
    <input className="input text-right" value={display} placeholder={placeholder} inputMode="numeric"
      onChange={(e) => onChange(parseNum(e.target.value))} style={style} />
  )
}

export function kindTag(kind) {
  const map = { income: ['income', '수입'], saving: ['save', '저축'], expense: ['expense', '지출'] }
  const [cls, label] = map[kind] || map.expense
  return <span className={`pill ${cls}`}>{label}</span>
}

export { KIND_STYLE }
