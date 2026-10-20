import { useRef, useState, type PointerEvent as RPointerEvent, type ReactNode, type WheelEvent as RWheelEvent } from 'react'
import { holdRepeat, input, type Action } from '../lib/input'
import { BackIcon, PlayPauseIcon } from '../lib/icons'
import './devices.css'

export const DEVICE_SIZE = {
  zune30: { w: 324, h: 592 },
  zune80: { w: 302, h: 536 },
  zunehd: { w: 348, h: 676 },
} as const

/* ───────────────── shared buttons ───────────────── */

/** Tap = back, hold = home (same as the real firmware). */
function BackButton({ className, icon = true }: { className: string; icon?: boolean }) {
  const timer = useRef<number | undefined>(undefined)
  const held = useRef(false)
  return (
    <button
      className={className}
      aria-label="back (hold for home)"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        held.current = false
        timer.current = window.setTimeout(() => { held.current = true; input.emit('home') }, 650)
      }}
      onPointerUp={() => {
        clearTimeout(timer.current)
        if (!held.current) input.emit('back')
      }}
      onPointerCancel={() => clearTimeout(timer.current)}
    >
      {icon && <BackIcon />}
    </button>
  )
}

function PlayButton({ className }: { className: string }) {
  return (
    <button className={className} aria-label="play / pause" onClick={() => input.emit('playpause')}>
      <PlayPauseIcon />
    </button>
  )
}

function regionFor(e: RPointerEvent<HTMLElement>, centerRatio: number): Action {
  const r = e.currentTarget.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width - 0.5
  const y = (e.clientY - r.top) / r.height - 0.5
  if (Math.hypot(x, y) < centerRatio) return 'select'
  return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up')
}

function useWheelSteps() {
  const acc = useRef(0)
  return (e: RWheelEvent) => {
    acc.current += e.deltaY
    while (Math.abs(acc.current) >= 40) {
      input.emit(acc.current > 0 ? 'down' : 'up')
      acc.current -= Math.sign(acc.current) * 40
    }
  }
}

function Screen({ children, className }: { children: ReactNode; className: string }) {
  const onWheel = useWheelSteps()
  return (
    <div className={`dv-screen ${className}`} onWheel={className.includes('hd') ? undefined : onWheel}>
      {children}
      <div className="dv-glare" />
    </div>
  )
}

/* ───────────────── Zune 30 (2006) ───────────────── */

export function Zune30({ color, children }: { color: string; children: ReactNode }) {
  const [tilt, setTilt] = useState<Action | null>(null)
  const stop = useRef<(() => void) | null>(null)
  const release = () => { stop.current?.(); stop.current = null; setTilt(null) }
  const onWheel = useWheelSteps()
  return (
    <div className={`dv dv-z30 c-${color}`}>
      <Z30Frame />
      <div className="dv-z30-window">
        <Screen className="dv-screen-classic">{children}</Screen>
      </div>
      <div
        className={`dv-z30-pad ${tilt ? `tilt-${tilt}` : ''}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          const a = regionFor(e, 0.2)
          setTilt(a)
          stop.current = a === 'select' ? (input.emit('select'), null) : holdRepeat(a)
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onWheel={onWheel}
      >
        <div className="dv-z30-center" />
      </div>
      <BackButton className="dv-z30-btn left" />
      <PlayButton className="dv-z30-btn right" />
      <div className="dv-hold" />
    </div>
  )
}

/**
 * The Zune 30's chrome surround: one "keyhole" piece that frames the screen
 * and drops through a short neck into the ring around the pad. Proportions follow a photo of a
 * brown Zune 30 (frame band ≈19px, ring band ≈18px at device scale).
 */
const Z30_OUTLINE =
  // Neck: tight 10px fillets off the screen frame run almost straight into the
  // pad ring (centered at 162,472), leaving only a few px of straight side.
  'M34 23 H290 A11 11 0 0 1 301 34 V375 A11 11 0 0 1 290 386 H210 A10 10 0 0 0 200 396 V399.3 ' +
  'A82 82 0 1 1 124 399.3 V396 A10 10 0 0 0 114 386 H34 A11 11 0 0 1 23 375 V34 A11 11 0 0 1 34 23 Z'

function Z30Frame() {
  return (
    <svg className="dv-z30-frame" viewBox="0 0 324 592" aria-hidden>
      <defs>
        {/* Polished chrome: hard light/dark reflection bands rather than a smooth fade. */}
        <linearGradient id="z30-chrome" x1="0" y1="0" x2=".55" y2="1">
          <stop offset="0" stopColor="#e2e5e8" />
          <stop offset=".1" stopColor="#c3c8cd" />
          <stop offset=".2" stopColor="#6e747a" />
          <stop offset=".3" stopColor="#c6cacf" />
          <stop offset=".42" stopColor="#8d9399" />
          <stop offset=".55" stopColor="#4f545a" />
          <stop offset=".66" stopColor="#b6bbc0" />
          <stop offset=".8" stopColor="#7c8288" />
          <stop offset=".9" stopColor="#b9bec3" />
          <stop offset="1" stopColor="#5a5f65" />
        </linearGradient>
        {/* Cross reflection so the bands vary along the frame like a curved, mirrored edge. */}
        <linearGradient id="z30-chrome-x" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".18" />
          <stop offset=".25" stopColor="#fff" stopOpacity=".12" />
          <stop offset=".5" stopColor="#000" stopOpacity="0" />
          <stop offset=".75" stopColor="#fff" stopOpacity=".1" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
      </defs>
      <path d={Z30_OUTLINE} fill="url(#z30-chrome)" stroke="rgba(0,0,0,.5)" strokeWidth="1" />
      <path d={Z30_OUTLINE} fill="url(#z30-chrome-x)" />
      {/* Bright rolled edge along the outer top of the chrome. */}
      <path d="M23.6 34 A10.4 10.4 0 0 1 34 23.6 H290 A10.4 10.4 0 0 1 300.4 34" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1" />
    </svg>
  )
}

/* ───────────────── Zune 80/120 (2007) ───────────────── */

export function Zune80({ color, children }: { color: string; children: ReactNode }) {
  const drag = useRef<{ y: number; x: number; acc: number; moved: boolean } | null>(null)
  const [touch, setTouch] = useState<{ x: number; y: number } | null>(null)
  const [press, setPress] = useState<Action | null>(null)
  const onWheel = useWheelSteps()

  const scaleOf = (el: HTMLElement) => el.getBoundingClientRect().height / el.offsetHeight || 1

  return (
    <div className={`dv dv-z80 c-${color}`}>
      <Screen className="dv-screen-classic dv-z80-screen">{children}</Screen>
      <div
        className={`dv-z80-pad ${press ? `press-${press}` : ''}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { y: e.clientY, x: e.clientX, acc: 0, moved: false }
          const r = e.currentTarget.getBoundingClientRect()
          setTouch({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const r = e.currentTarget.getBoundingClientRect()
          setTouch({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
          // Touch-scrolling: every ~16px of travel on the pad moves one item.
          const step = 16 * scaleOf(e.currentTarget)
          const dy = e.clientY - d.y
          d.acc += dy
          d.y = e.clientY
          if (Math.abs(e.clientX - d.x) > step * 0.6 || Math.abs(d.acc) > step * 0.6) d.moved = true
          while (Math.abs(d.acc) >= step) {
            input.emit(d.acc > 0 ? 'down' : 'up')
            d.acc -= Math.sign(d.acc) * step
          }
        }}
        onPointerUp={(e) => {
          const d = drag.current
          drag.current = null
          setTouch(null)
          if (d && !d.moved) {
            const a = regionFor(e, 0.22)
            setPress(a)
            setTimeout(() => setPress(null), 140)
            input.emit(a)
          }
        }}
        onPointerCancel={() => { drag.current = null; setTouch(null) }}
        onWheel={onWheel}
      >
        {touch && <div className="dv-z80-touch" style={{ left: `${touch.x * 100}%`, top: `${touch.y * 100}%` }} />}
        <span className="dv-z80-nub up" /><span className="dv-z80-nub down" />
        <span className="dv-z80-nub left" /><span className="dv-z80-nub right" />
      </div>
      <BackButton className="dv-z80-btn left" />
      <PlayButton className="dv-z80-btn right" />
    </div>
  )
}

/* ───────────────── Zune HD (2009) ───────────────── */

export function ZuneHD({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div className={`dv dv-hd c-${color}`}>
      <button className="dv-hd-top media" aria-label="media controls" onClick={() => input.emit('media')} />
      <button className="dv-hd-top power" aria-label="power" onClick={() => input.emit('power')} />
      <div className="dv-hd-glass">
        <Screen className="dv-screen-hd">{children}</Screen>
        <BackButton className="dv-hd-home" icon={false} />
      </div>
    </div>
  )
}
