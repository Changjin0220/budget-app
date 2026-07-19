import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  LineChart, Line, ComposedChart, Legend, AreaChart, Area,
} from 'recharts'
import { won, num } from '../utils/format'
import { PALETTE } from '../data/defaults'

const AXIS = { fontSize: 11, fill: '#9a9aa8' }
const tooltipStyle = {
  borderRadius: 10, border: '1px solid #e8e8ee', fontSize: 12,
  boxShadow: '0 6px 20px rgba(40,30,80,.12)', fontFamily: 'inherit',
}

function fmtTip(v) { return num(v) + '원' }

// ---------- 도넛 (저축률 등) ----------
export function DonutChart({ data, height = 220, colors = PALETTE, centerTop, centerMain, centerSub, innerRadius = 62, outerRadius = 92, showLegend = false }) {
  const total = data.reduce((a, d) => a + d.value, 0)
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
            innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={1.5} stroke="none"
            startAngle={90} endAngle={-270}>
            {data.map((d, i) => <Cell key={i} fill={d.color || colors[i % colors.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [fmtTip(v) + (total ? ` (${((v / total) * 100).toFixed(1)}%)` : ''), n]} />
          {showLegend && <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 11 }} />}
        </PieChart>
      </ResponsiveContainer>
      {(centerMain !== undefined) && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          paddingBottom: showLegend ? 28 : 0,
        }}>
          {centerTop && <div style={{ fontSize: 12, color: '#5a5a68', fontWeight: 700 }}>{centerTop}</div>}
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-.5px' }}>{centerMain}</div>
          {centerSub && <div style={{ fontSize: 13, fontWeight: 800, marginTop: 2 }}>{centerSub}</div>}
        </div>
      )}
    </div>
  )
}

// ---------- 세로 막대 (수입/지출 top) ----------
export function BarV({ data, height = 240, color = '#f2c94c', colorful = false }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: '#eee' }} interval={0} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={54} tickFormatter={(v) => num(v)} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtTip(v), '금액']} cursor={{ fill: 'rgba(139,122,214,.06)' }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={46}>
          {data.map((d, i) => <Cell key={i} fill={colorful ? PALETTE[i % PALETTE.length] : color} />)}
          <LabelList dataKey="value" position="top" formatter={(v) => num(v)} style={{ fontSize: 11, fill: '#5a5a68', fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------- 가로 막대 (지출 소분류 top10) ----------
export function BarH({ data, height = 300, colorful = true, color = '#b3a4e0' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => num(v)} />
        <YAxis type="category" dataKey="name" tick={{ ...AXIS, fill: '#5a5a68' }} tickLine={false} axisLine={false} width={92} interval={0} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtTip(v), '금액']} cursor={{ fill: 'rgba(139,122,214,.06)' }} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}>
          {data.map((d, i) => <Cell key={i} fill={colorful ? PALETTE[i % PALETTE.length] : color} />)}
          <LabelList dataKey="value" position="right" formatter={(v) => num(v)} style={{ fontSize: 11, fill: '#5a5a68', fontWeight: 700 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------- 일별 지출 라인 ----------
export function DailyLine({ data, height = 200, color = '#b3a4e0' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
        <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={{ stroke: '#eee' }} interval={2} tickFormatter={(d) => `${d}`} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={54} tickFormatter={(v) => num(v)} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtTip(v), '지출']} labelFormatter={(d) => `${d}일`} />
        <Line type="monotone" dataKey="amount" stroke={color} strokeWidth={2} dot={{ r: 2, fill: color }} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------- 연간 월별흐름도 (수입/저축/지출 막대 + 저축률 라인) ----------
export function MonthlyFlow({ data, height = 320 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
        <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={{ stroke: '#eee' }} />
        <YAxis yAxisId="left" tick={AXIS} tickLine={false} axisLine={false} width={58} tickFormatter={(v) => num(v)} />
        <YAxis yAxisId="right" orientation="right" tick={AXIS} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${Math.round(v * 100)}%`} domain={[0, 1]} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => (n === '저축률' ? [`${(v * 100).toFixed(0)}%`, n] : [fmtTip(v), n])} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="left" dataKey="수입" fill="#f7db8a" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar yAxisId="left" dataKey="저축/현금" fill="#a8ddd5" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar yAxisId="left" dataKey="지출" fill="#c9c2ec" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Line yAxisId="right" type="monotone" dataKey="저축률" stroke="#9a8fc4" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ---------- 자산: 순자산 막대 ----------
export function AssetBar({ data, height = 240, color = '#a8ddd5' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
        <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={{ stroke: '#eee' }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => num(v)} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtTip(v), '순자산']} />
        <Bar dataKey="value" fill={color} radius={[5, 5, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------- 자산 추이 미니 라인 ----------
export function MiniTrend({ data, height = 150, color = '#b3a4e0' }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
        <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#b0b0bc' }} tickLine={false} axisLine={{ stroke: '#eee' }} interval={0} />
        <YAxis hide />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtTip(v), '']} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------- 자산 구성 100% 영역 ----------
export function StackedComposition({ data, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} stackOffset="expand" margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
        <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={{ stroke: '#eee' }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtTip(v)} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        <Area type="monotone" dataKey="비유동자산" stackId="1" stroke="#c9c2ec" fill="#d8cfef" />
        <Area type="monotone" dataKey="투자자산" stackId="1" stroke="#f2c94c" fill="#f9e2a3" />
        <Area type="monotone" dataKey="현금자산" stackId="1" stroke="#a8ddd5" fill="#c4ebe4" />
        <Area type="monotone" dataKey="부채" stackId="1" stroke="#b3a4e0" fill="#cabff0" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
