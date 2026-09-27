import { useEffect, useState, useSyncExternalStore } from 'react'
import type { PlayRequest } from '../library/types'

export interface Track {
  uri: string
  title: string
  artist: string
  album: string
  image?: string
  imageLarge?: string
  durationMs: number
}

export type Repeat = 'off' | 'context' | 'track'

export interface PlaybackState {
  status: 'idle' | 'connecting' | 'ready' | 'error'
  /** Transient message (errors, "premium required", …). */
  message?: string
  track: Track | null
  paused: boolean
  /** Position at `stamp` (ms since epoch). Interpolate for a live value. */
  positionMs: number
  stamp: number
  volume: number
  shuffle: boolean
  repeat: Repeat
  next: Track[]
}

export interface Playback {
  getState(): PlaybackState
  subscribe(fn: () => void): () => void
  /** Call from a user gesture — lets browsers allow audio. */
  activate(): void
  play(req: PlayRequest): Promise<void>
  toggle(): void
  next(): void
  prev(): void
  seek(ms: number): void
  setVolume(v: number): void
  setShuffle(on: boolean): void
  setRepeat(r: Repeat): void
  destroy(): void
}

export const initialState: PlaybackState = {
  status: 'idle', track: null, paused: true, positionMs: 0, stamp: Date.now(),
  volume: 0.6, shuffle: false, repeat: 'off', next: [],
}

export function createStore(init: PlaybackState) {
  let state = init
  const subs = new Set<() => void>()
  return {
    get: () => state,
    set(patch: Partial<PlaybackState>) {
      state = { ...state, ...patch }
      subs.forEach((s) => s())
    },
    subscribe(fn: () => void) {
      subs.add(fn)
      return () => { subs.delete(fn) }
    },
  }
}

export function usePlaybackState(pb: Playback) {
  return useSyncExternalStore(pb.subscribe, pb.getState)
}

export function livePosition(s: PlaybackState) {
  if (!s.track) return 0
  const p = s.paused ? s.positionMs : s.positionMs + (Date.now() - s.stamp)
  return Math.min(Math.max(0, p), s.track.durationMs)
}

/** Re-renders a few times a second while playing. */
export function usePosition(s: PlaybackState) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (s.paused || !s.track) return
    const id = setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [s.paused, s.track])
  return livePosition(s)
}
