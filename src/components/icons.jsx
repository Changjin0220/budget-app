// 미니멀 라인 아이콘 세트 (이모지 대체용) — 24x24 그리드, currentColor stroke
function Svg({ size = 16, children, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      {...rest}>
      {children}
    </svg>
  )
}

export const IconTrash = (p) => (
  <Svg {...p}><path d="M4 7h16" /><path d="M9 7V4.8c0-.44.36-.8.8-.8h4.4c.44 0 .8.36.8.8V7" />
    <path d="M6 7l1 12.2c.05.99.87 1.8 1.87 1.8h6.26c1 0 1.82-.81 1.87-1.8L18 7" />
    <path d="M10 11v6M14 11v6" /></Svg>
)
export const IconClose = (p) => (
  <Svg {...p}><path d="M5 5l14 14M19 5L5 19" /></Svg>
)
export const IconSearch = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.3-4.3" /></Svg>
)
export const IconBell = (p) => (
  <Svg {...p}><path d="M6 10a6 6 0 1112 0c0 4 1.4 5.6 2 6.4H4c.6-.8 2-2.4 2-6.4z" />
    <path d="M10 19a2 2 0 004 0" /></Svg>
)
export const IconPaperclip = (p) => (
  <Svg {...p}><path d="M8 12.5l6.2-6.2a3 3 0 014.3 4.3l-8 8a5 5 0 01-7-7l7.2-7.2" /></Svg>
)
export const IconDownload = (p) => (
  <Svg {...p}><path d="M12 4v11" /><path d="M7.5 11.5L12 16l4.5-4.5" /><path d="M5 19.5h14" /></Svg>
)
export const IconUpload = (p) => (
  <Svg {...p}><path d="M12 16V5" /><path d="M7.5 9.5L12 5l4.5 4.5" /><path d="M5 19.5h14" /></Svg>
)
export const IconRefresh = (p) => (
  <Svg {...p}><path d="M4 10a8 8 0 0113.9-5.4L20 7" /><path d="M20 4v3.5h-3.5" />
    <path d="M20 14a8 8 0 01-13.9 5.4L4 17" /><path d="M4 20v-3.5h3.5" /></Svg>
)
export const IconUndo = (p) => (
  <Svg {...p}><path d="M6 8H4V6" /><path d="M4.5 8A8 8 0 1113 19.6" /></Svg>
)
export const IconSort = (p) => (
  <Svg {...p}><path d="M8 5v14M8 5L5 8M8 5l3 3" /><path d="M16 19V5M16 19l3-3M16 19l-3-3" /></Svg>
)
export const IconCloud = (p) => (
  <Svg {...p}><path d="M7.5 18.5A4.5 4.5 0 018 9.6a5.5 5.5 0 0110.6 1.9A3.9 3.9 0 0118 18.5H7.5z" /></Svg>
)
export const IconMenu = (p) => (
  <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
)
export const IconCalendar = (p) => (
  <Svg {...p}><rect x="4" y="5.5" width="16" height="15" rx="3" /><path d="M4 10h16" />
    <path d="M8.5 3.5v3M15.5 3.5v3" /></Svg>
)
export const IconSwap = (p) => (
  <Svg {...p}><path d="M5 8h13" /><path d="M15 4.5L18.5 8 15 11.5" />
    <path d="M19 16H6" /><path d="M9 12.5L5.5 16 9 19.5" /></Svg>
)
export const IconReceipt = (p) => (
  <Svg {...p}><path d="M6 3.5h12v17l-2.3-1.6L14 20.5l-2-1.6-2 1.6-1.7-1.6L6 20.5z" />
    <path d="M9 8h6M9 12h6M9 16h3.5" /></Svg>
)
export const IconArrowRight = (p) => (
  <Svg {...p}><path d="M4 12h15" /><path d="M13 6l6 6-6 6" /></Svg>
)
export const IconSave = (p) => (
  <Svg {...p}><path d="M5 4.5h11L20 8.5V19a1 1 0 01-1 1H5a1 1 0 01-1-1V5.5a1 1 0 011-1z" />
    <path d="M8 4.5V9h7V4.5" /><path d="M8 14h8v5.5H8z" /></Svg>
)
export const IconChevronDown = (p) => (
  <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
)
export const IconEdit = (p) => (
  <Svg {...p}><path d="M4 20l.9-4L16.5 4.4a1.5 1.5 0 012.1 0l1 1a1.5 1.5 0 010 2.1L8 19.1 4 20z" />
    <path d="M14.5 6.5l3 3" /></Svg>
)
export const IconBook = (p) => (
  <Svg {...p}><path d="M5 5.2C5 4.5 5.6 4 6.3 4H12v16H6.3c-.7 0-1.3-.5-1.3-1.2z" />
    <path d="M19 5.2c0-.7-.6-1.2-1.3-1.2H12v16h5.7c.7 0 1.3-.5 1.3-1.2z" />
    <path d="M12 4v16" /></Svg>
)
export const IconImage = (p) => (
  <Svg {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" /><path d="M20 16l-4.8-4.8a1.5 1.5 0 00-2.1 0L4 20.5" /></Svg>
)
