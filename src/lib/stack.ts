import { useCallback, useRef, useState } from 'react'
import type { Action } from './input'

/** Per-page UI state that survives navigating away and back. */
export interface PageUI {
  sel?: number
  pivot?: number
  sels?: number[]
  q?: string
  submitted?: string
  scroll?: number
}

export interface Page<K> {
  id: number
  kind: K
  ui: PageUI
}

export type Handler = (a: Action) => boolean

export function useStack<K>(root: K) {
  const nextId = useRef(1)
  const [stack, setStack] = useState<Page<K>[]>([{ id: 0, kind: root, ui: {} }])
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd')

  const push = useCallback((kind: K, ui: PageUI = {}) => {
    setDir('fwd')
    setStack((s) => [...s, { id: nextId.current++, kind, ui }])
  }, [])

  const depthRef = useRef(1)
  depthRef.current = stack.length

  const pop = useCallback(() => {
    if (depthRef.current <= 1) return false
    depthRef.current -= 1
    setDir('back')
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
    return true
  }, [])

  const home = useCallback(() => {
    setDir('back')
    setStack((s) => s.slice(0, 1))
  }, [])

  /** Replace the top page (e.g. "now playing" → album without growing the stack). */
  const replace = useCallback((kind: K, ui: PageUI = {}) => {
    setDir('fwd')
    setStack((s) => [...s.slice(0, -1), { id: nextId.current++, kind, ui }])
  }, [])

  const update = useCallback((patch: PageUI) => {
    setStack((s) => {
      const top = s[s.length - 1]
      return [...s.slice(0, -1), { ...top, ui: { ...top.ui, ...patch } }]
    })
  }, [])

  return { stack, top: stack[stack.length - 1], depth: stack.length, dir, push, pop, home, replace, update }
}

export type Nav<K> = ReturnType<typeof useStack<K>>

/** Standard up/down list movement without wrap-around. */
export function moveSel(a: Action, sel: number, len: number): number | null {
  if (a === 'up') return Math.max(0, sel - 1)
  if (a === 'down') return Math.min(Math.max(0, len - 1), sel + 1)
  return null
}
