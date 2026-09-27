import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = (p: P) => ({ viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true, ...p })

export const PlayIcon = (p: P) => <svg {...base(p)}><path d="M7 4.5v15l12.5-7.5z" /></svg>
export const PauseIcon = (p: P) => <svg {...base(p)}><rect x="6" y="4.5" width="4" height="15" /><rect x="14" y="4.5" width="4" height="15" /></svg>
export const PrevIcon = (p: P) => <svg {...base(p)}><rect x="4" y="5" width="2.5" height="14" /><path d="M20 5v14L8 12z" /></svg>
export const NextIcon = (p: P) => <svg {...base(p)}><rect x="17.5" y="5" width="2.5" height="14" /><path d="M4 5v14l12-7z" /></svg>
export const BackIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 6 4 12l6 6M4.5 12H20" />
  </svg>
)
export const PlayPauseIcon = (p: P) => (
  <svg {...base(p)} viewBox="0 0 28 24"><path d="M2 4.5v15l10-7.5z" /><rect x="16" y="4.5" width="3.5" height="15" /><rect x="22.5" y="4.5" width="3.5" height="15" /></svg>
)
export const ShuffleIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h3.5c4.5 0 6.5 10 11 10H21M3 17h3.5c1.8 0 3.1-1.6 4.2-3.6M13.3 9.6C14.4 8.1 15.7 7 17.5 7H21M18.5 4.5 21 7l-2.5 2.5M18.5 14.5 21 17l-2.5 2.5" />
  </svg>
)
export const RepeatIcon = ({ one, ...p }: P & { one?: boolean }) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 11V9.5A2.5 2.5 0 0 1 6.5 7H20M17.5 4.5 20 7l-2.5 2.5M20 13v1.5a2.5 2.5 0 0 1-2.5 2.5H4M6.5 19.5 4 17l2.5-2.5" />
    {one && <path d="M11.3 10.6 12.4 10v4.2" strokeWidth="1.5" />}
  </svg>
)
export const SearchIcon = (p: P) => (
  <svg {...base(p)} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5.5 5.5" strokeLinecap="round" /></svg>
)
export const ArrowRightCircle = (p: P) => (
  <svg {...base(p)} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="20" cy="20" r="17" /><path d="M13 20h13M20.5 14l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function Battery({ level = 0.8 }: { level?: number }) {
  return (
    <svg viewBox="0 0 22 11" width="19" height="9.5" aria-hidden>
      <rect x="0.6" y="0.6" width="18.3" height="9.8" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="19.4" y="3.4" width="1.8" height="4.2" rx=".6" fill="currentColor" />
      <rect x="2.2" y="2.2" width={15 * level} height="6.6" rx=".4" fill="currentColor" />
    </svg>
  )
}

export function Wifi() {
  return (
    <svg viewBox="0 0 16 12" width="13" height="10" aria-hidden fill="currentColor">
      <rect x="0" y="8" width="3" height="4" /><rect x="4.3" y="5.5" width="3" height="6.5" />
      <rect x="8.6" y="3" width="3" height="9" /><rect x="12.9" y="0" width="3" height="12" />
    </svg>
  )
}
