interface IconProps {
  size?: number
  stroke?: string
  fill?: string
  sw?: number
  style?: React.CSSProperties
}

const Icon = ({ d, size = 18, fill = 'none', stroke, sw = 1.5, style }: IconProps & { d: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
    stroke={stroke || 'currentColor'} strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" style={style}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
)

// ── Pet icon variants ─────────────────────────────────────────────────────────

/** Classic — outlined dog face with floppy ears, snout, eyes */
function PetClassic(p: IconProps) {
  return <Icon {...p} d={<>
    <circle cx="12" cy="11" r="7" />
    <path d="M5 8 Q3 4 5.5 2 Q7 6 5 8z" />
    <path d="M19 8 Q21 4 18.5 2 Q17 6 19 8z" />
    <ellipse cx="12" cy="14" rx="2.8" ry="1.8" />
    <ellipse cx="12" cy="13" rx="1.1" ry="0.7" fill="currentColor" />
    <circle cx="9.2" cy="9.5" r="0.9" fill="currentColor" />
    <circle cx="14.8" cy="9.5" r="0.9" fill="currentColor" />
  </>} />
}

/** Flat face — Boston Terrier style, bat ears, simple bold outline */
function PetFlatFace(p: IconProps) {
  return (
    <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={p.sw || 1.5}
      strokeLinecap="round" strokeLinejoin="round" style={p.style}>
      {/* Round head */}
      <circle cx="12" cy="13" r="7.5" />
      {/* Bat/pointed ears */}
      <path d="M6.5 7.5 L4.5 2.5 L10 6.5" />
      <path d="M17.5 7.5 L19.5 2.5 L14 6.5" />
      {/* Eyes */}
      <circle cx="9.5" cy="11.5" r="1.4" />
      <circle cx="14.5" cy="11.5" r="1.4" />
      {/* Nose */}
      <path d="M11 15 Q12 16.2 13 15" strokeWidth={1.2} />
      <ellipse cx="12" cy="14.5" rx="1.2" ry="0.8" />
    </svg>
  )
}

/** Paw print — 4 toe pads + 1 main pad */
function PetPaw(p: IconProps) {
  return (
    <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24"
      fill="currentColor" stroke="none" style={p.style}>
      {/* Main pad */}
      <ellipse cx="12" cy="17.5" rx="4.5" ry="3.5" />
      {/* 4 toe pads */}
      <ellipse cx="6.5" cy="12.5" rx="2.1" ry="2.4" />
      <ellipse cx="11" cy="10" rx="2.1" ry="2.4" />
      <ellipse cx="15.5" cy="10.5" rx="2.1" ry="2.4" />
      <ellipse cx="19.5" cy="13" rx="2.1" ry="2.4" />
    </svg>
  )
}

// ── Dynamic pet icon style (set by App.tsx from settings) ────────────────────

export type PetIconStyle = 'classic' | 'face' | 'paw'
let _petStyle: PetIconStyle = 'classic'

/** Call this from App.tsx whenever settings.petIcon changes */
export function setPetStyle(style: PetIconStyle) {
  _petStyle = style
}

/** The 3 selectable pet SVG renderers — for use in SettingsScreen picker */
export const PET_ICON_OPTIONS: Array<{
  id: PetIconStyle
  label: string
  render: (p: IconProps) => JSX.Element
}> = [
  { id: 'classic', label: 'Classic',    render: PetClassic  },
  { id: 'face',    label: 'Flat Face',  render: PetFlatFace },
  { id: 'paw',     label: 'Paw Print',  render: PetPaw      },
]

// ── Icon map ──────────────────────────────────────────────────────────────────

export const Icons: Record<string, (p: IconProps) => JSX.Element> = {
  plus:      (p) => <Icon {...p} d="M12 5v14M5 12h14" />,
  cart:      (p) => <Icon {...p} d={<><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></>} />,
  check:     (p) => <Icon {...p} d="M5 12.5l4.5 4.5L19 7.5" />,
  arrow:     (p) => <Icon {...p} d="M5 12h14M13 6l6 6-6 6" />,
  back:      (p) => <Icon {...p} d="M19 12H5M11 6l-6 6 6 6" />,
  more:      (p) => <Icon {...p} d={<><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></>} fill="currentColor" stroke="none" />,
  mic:       (p) => <Icon {...p} d={<><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></>} />,
  flame:     (p) => <Icon {...p} d="M12 3c.5 3 3 4 3 7a3 3 0 11-6 0c0-1 .5-1.5 1-2-.5 4-3 5-3 8a5 5 0 0010 0c0-5-5-7-5-13z" />,
  bolt:      (p) => <Icon {...p} d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />,
  timer:     (p) => <Icon {...p} d={<><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 3h6"/></>} />,
  play:      (p) => <Icon {...p} d="M7 5l11 7-11 7V5z" fill="currentColor" stroke="none" />,
  pause:     (p) => <Icon {...p} d={<><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></>} fill="currentColor" stroke="none" />,
  reset:     (p) => <Icon {...p} d="M4 4v6h6M20 14a8 8 0 11-3-7" />,
  calendar:  (p) => <Icon {...p} d={<><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>} />,
  list:      (p) => <Icon {...p} d="M4 6h16M4 12h16M4 18h10" />,
  inbox:     (p) => <Icon {...p} d="M3 13l3-8h12l3 8v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6zM3 13h5l1 3h6l1-3h5" />,
  chart:     (p) => <Icon {...p} d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  user:      (p) => <Icon {...p} d={<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></>} />,
  search:    (p) => <Icon {...p} d={<><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></>} />,
  settings:  (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="3"/><path strokeWidth={1.2} d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h.1a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v.1a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></>} />,
  close:     (p) => <Icon {...p} d="M6 6l12 12M18 6L6 18" />,
  tag:       (p) => <Icon {...p} d={<><path d="M3 12V3h9l9 9-9 9-9-9z"/><circle cx="7.5" cy="7.5" r="1" fill="currentColor"/></>} />,
  rss:       (p) => <Icon {...p} d={<><path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16"/><circle cx="5" cy="19" r="1.5" fill="currentColor"/></>} />,
  edit:      (p) => <Icon {...p} d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4" />,
  sparkle:   (p) => <Icon {...p} d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />,
  leaf:      (p) => <Icon {...p} d="M5 19c8 0 14-6 14-14-6 0-14 4-14 12v2zM5 19c2-4 5-7 9-9" />,
  drop:      (p) => <Icon {...p} d="M12 3l5 7a6 6 0 11-10 0l5-7z" />,
  dollar:    (p) => <Icon {...p} d="M12 3v18M16 7H10a3 3 0 000 6h4a3 3 0 010 6H8" />,
  briefcase: (p) => <Icon {...p} d={<><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/></>} />,
  book:      (p) => <Icon {...p} d="M4 5a2 2 0 012-2h6v18H6a2 2 0 01-2-2V5zM12 3h6a2 2 0 012 2v14a2 2 0 01-2 2h-6V3z" />,
  heart:     (p) => <Icon {...p} d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" />,
  home:      (p) => <Icon {...p} d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-9z" />,
  family:    (p) => <Icon {...p} d={<><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20a5 5 0 0110 0M11 20a5 5 0 0110 0"/></>} />,
  target:    (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>} />,
  journal:   (p) => <Icon {...p} d="M5 4h12a2 2 0 012 2v14l-3-2-3 2-3-2-3 2-3-2V6a2 2 0 012-2zM9 8h6M9 12h6M9 16h4" />,
  sun:       (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></>} />,
  moon:      (p) => <Icon {...p} d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />,
  bell:      (p) => <Icon {...p} d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15L6 16zM10 21a2 2 0 004 0" />,
  download:  (p) => <Icon {...p} d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />,
  layers:    (p) => <Icon {...p} d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" />,
  repeat:    (p) => <Icon {...p} d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />,
  folder:    (p) => <Icon {...p} d="M4 20h16a2 2 0 002-2V8a2 2 0 00-2-2h-8L10 4H4a2 2 0 00-2 2v12a2 2 0 002 2z" />,

  // Dynamic pet icon — reads from module-level style set by App.tsx via setPetStyle()
  pet: (p) => {
    if (_petStyle === 'face') return PetFlatFace(p)
    if (_petStyle === 'paw')  return PetPaw(p)
    return PetClassic(p)
  },
}
