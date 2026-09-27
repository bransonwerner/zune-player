// Hardware-agnostic input. Device shells (d-pad, Zune Pad, buttons) and the
// keyboard all emit the same actions; the on-screen OS consumes them.

import { useEffect, useRef } from 'react'

export type Action =
  | 'up' | 'down' | 'left' | 'right' | 'select'
  | 'back' | 'home' | 'playpause'
  | 'volup' | 'voldown'
  | 'media' | 'power'

type Listener = (a: Action) => void
const listeners = new Set<Listener>()

export const input = {
  emit(a: Action) {
    listeners.forEach((l) => l(a))
  },
  on(fn: Listener) {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },
}

export function useInput(fn: Listener) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => input.on((a) => ref.current(a)), [])
}

/** Press-and-hold auto-repeat, like holding the d-pad on the real hardware. */
export function holdRepeat(action: Action, delay = 380, interval = 90) {
  input.emit(action)
  let iv: number | undefined
  const t = window.setTimeout(() => {
    iv = window.setInterval(() => input.emit(action), interval)
  }, delay)
  return () => {
    clearTimeout(t)
    if (iv) clearInterval(iv)
  }
}
