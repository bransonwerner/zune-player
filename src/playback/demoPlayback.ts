// Simulated player for demo mode: advances time and the queue, no audio.

import type { DemoIndex } from '../library/demoLibrary'
import type { Item } from '../library/types'
import { createStore, initialState, livePosition, type Playback, type Track } from './types'

const toTrack = (i: Item): Track => ({
  uri: i.uri, title: i.title, artist: i.artistName ?? i.subtitle ?? '', album: i.albumName ?? '',
  image: i.image, imageLarge: i.imageLarge, durationMs: i.durationMs ?? 180_000,
})

export function createDemoPlayback(index: DemoIndex): Playback {
  const store = createStore({ ...initialState, status: 'ready' })
  let queue: Item[] = []
  let order: number[] = []
  let pos = 0

  const load = (at: number, keepPaused = false) => {
    pos = (at + order.length) % order.length
    const cur = queue[order[pos]]
    store.set({
      track: toTrack(cur),
      positionMs: 0,
      stamp: Date.now(),
      paused: keepPaused ? store.get().paused : false,
      next: order.slice(pos + 1, pos + 4).map((i) => toTrack(queue[i])),
    })
  }

  const reorder = (shuffle: boolean, currentIdx: number) => {
    order = queue.map((_, i) => i)
    if (shuffle) {
      order.splice(currentIdx, 1)
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[order[i], order[j]] = [order[j], order[i]]
      }
      order.unshift(currentIdx)
    }
  }

  const advance = (auto: boolean) => {
    if (!queue.length) return
    const { repeat } = store.get()
    if (auto && repeat === 'track') return load(pos)
    if (pos + 1 >= order.length && repeat === 'off') {
      store.set({ paused: true, positionMs: 0, stamp: Date.now() })
      return
    }
    load(pos + 1)
  }

  const timer = setInterval(() => {
    const s = store.get()
    if (s.track && !s.paused && livePosition(s) >= s.track.durationMs) advance(true)
  }, 400)

  return {
    getState: store.get,
    subscribe: store.subscribe,
    activate() {},
    async play(req) {
      queue = req.contextUri
        ? index.contexts.get(req.contextUri) ?? []
        : (req.uris ?? []).map((u) => index.byUri.get(u)).filter((x): x is Item => !!x)
      if (!queue.length) return
      const start = Math.max(0, queue.findIndex((q) => q.uri === req.offsetUri))
      const shuffle = store.get().shuffle
      reorder(shuffle, start)
      load(shuffle ? 0 : start)
    },
    toggle() {
      const s = store.get()
      if (!s.track) return
      store.set({ paused: !s.paused, positionMs: livePosition(s), stamp: Date.now() })
    },
    next() { advance(false) },
    prev() {
      if (!queue.length) return
      if (livePosition(store.get()) > 3000 || pos === 0) store.set({ positionMs: 0, stamp: Date.now() })
      else load(pos - 1)
    },
    seek(ms) { store.set({ positionMs: ms, stamp: Date.now() }) },
    setVolume(v) { store.set({ volume: Math.min(1, Math.max(0, v)) }) },
    setShuffle(on) {
      store.set({ shuffle: on })
      if (queue.length) {
        const cur = order[pos]
        reorder(on, cur)
        pos = on ? 0 : cur
        store.set({ next: order.slice(pos + 1, pos + 4).map((i) => toTrack(queue[i])) })
      }
    },
    setRepeat(r) { store.set({ repeat: r }) },
    destroy() { clearInterval(timer) },
  }
}
