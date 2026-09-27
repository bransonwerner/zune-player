// Zune HD firmware — 272×480 touch UI: panoramic home, giant pivots,
// turnstile transitions and the full-bleed now playing screen.

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { useInput } from '../../lib/input'
import { MODELS, useAsync, useClock, useServices } from '../../lib/services'
import { useStack, type Handler, type Nav, type Page } from '../../lib/stack'
import {
  ArrowRightCircle, Battery, NextIcon, PauseIcon, PlayIcon, PrevIcon, RepeatIcon, ShuffleIcon, Wifi,
} from '../../lib/icons'
import { fmtTime, playRequestFor, type Item, type SearchResults } from '../../library/types'
import { usePlaybackState, usePosition, type Repeat } from '../../playback/types'
import './hd.css'

type HKind =
  | { t: 'home' }
  | { t: 'music' }
  | { t: 'collection'; item: Item }
  | { t: 'now' }
  | { t: 'marketplace' }
  | { t: 'settings' }
  | { t: 'message'; title: string; text: string }

interface Ctx {
  nav: Nav<HKind>
  page: Page<HKind>
  setHandler(h: Handler | null): void
  open(item: Item, list: Item[], contextUri?: string): void
}

export function HdOS() {
  const { playback } = useServices()
  const st = usePlaybackState(playback)
  const nav = useStack<HKind>({ t: 'home' })
  const handler = useRef<Handler | null>(null)
  const [media, setMedia] = useState(false)
  const [off, setOff] = useState(false)
  const screen = useRef<HTMLDivElement>(null)

  useInput((a) => {
    if (a === 'power') { setOff((o) => !o); return }
    if (off) { if (a === 'home' || a === 'back' || a === 'media') setOff(false); return }
    if (a === 'media') { setMedia((m) => !m); return }
    if (media && a === 'back') { setMedia(false); return }
    if (handler.current?.(a)) return
    if (a === 'back') nav.pop()
    else if (a === 'home') { setMedia(false); nav.home() }
    else if (a === 'playpause') playback.toggle()
    else if (a === 'volup') playback.setVolume(st.volume + 0.05)
    else if (a === 'voldown') playback.setVolume(st.volume - 0.05)
    else if (a === 'up' || a === 'down') {
      const el = screen.current?.querySelector<HTMLElement>('.zh-page:last-child .zh-scroll')
      el?.scrollBy({ top: a === 'down' ? 90 : -90, behavior: 'smooth' })
    }
  })

  const ctx: Ctx = {
    nav,
    page: nav.top,
    setHandler: (h) => { handler.current = h },
    open(item, list, contextUri) {
      if (item.kind === 'track' || item.kind === 'episode') {
        playback.play(playRequestFor(list, item, contextUri))
        nav.push({ t: 'now' })
      } else nav.push({ t: 'collection', item })
    },
  }

  const k = nav.top.kind
  return (
    <div className="zh" ref={screen}>
      {k.t !== 'now' && <StatusBar />}
      <div key={nav.top.id} className={`zh-page zh-${nav.dir} ${k.t === 'now' ? 'zh-page-full' : ''}`}>
        <PageSwitch ctx={ctx} />
      </div>
      <MediaOverlay open={media} onClose={() => setMedia(false)} onOpenNow={() => { setMedia(false); if (k.t !== 'now') nav.push({ t: 'now' }) }} />
      <Toast message={st.message} />
      <div className={`zh-off ${off ? 'on' : ''}`} onClick={() => setOff(false)} />
    </div>
  )
}

function PageSwitch({ ctx }: { ctx: Ctx }) {
  const k = ctx.page.kind
  switch (k.t) {
    case 'home': return <Home ctx={ctx} />
    case 'music': return <Music ctx={ctx} />
    case 'collection': return <Collection ctx={ctx} item={k.item} />
    case 'now': return <NowPlaying ctx={ctx} />
    case 'marketplace': return <Marketplace ctx={ctx} />
    case 'settings': return <Settings ctx={ctx} />
    case 'message': return <Message title={k.title} text={k.text} />
  }
}

function useHandler(ctx: Ctx, h: Handler) {
  const ref = useRef(h)
  ref.current = h
  useEffect(() => {
    ctx.setHandler((a) => ref.current(a))
    return () => ctx.setHandler(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/* ───────────────────────── touch helpers ───────────────────────── */

/** Horizontal swipe detection that plays nicely with vertical scrolling. */
function useSwipe(onSwipe: (dir: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  return {
    onPointerDown: (e: RPointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY }
      swiped.current = false
    },
    onPointerUp: (e: RPointerEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      const el = e.currentTarget as HTMLElement
      const scale = el.getBoundingClientRect().width / el.offsetWidth || 1
      if (Math.abs(dx) > 45 * scale && Math.abs(dx) > Math.abs(dy) * 1.4) {
        swiped.current = true
        onSwipe(dx < 0 ? 1 : -1)
      }
    },
    // A swipe shouldn't also count as a tap on whatever it started over.
    onClickCapture: (e: RMouseEvent) => {
      if (swiped.current) {
        swiped.current = false
        e.stopPropagation()
      }
    },
  }
}

/** Lets a mouse drag scroll a list like a finger would. Suppresses the click after a drag. */
function DragScroll({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; top: number; moved: boolean } | null>(null)
  return (
    <div
      ref={ref}
      className={`zh-scroll ${className}`}
      onPointerDown={(e) => {
        if (e.pointerType !== 'mouse' || !ref.current) return
        drag.current = { y: e.clientY, top: ref.current.scrollTop, moved: false }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d || !ref.current) return
        const scale = ref.current.getBoundingClientRect().height / ref.current.offsetHeight || 1
        const dy = (e.clientY - d.y) / scale
        if (Math.abs(dy) > 5) d.moved = true
        if (d.moved) ref.current.scrollTop = d.top - dy
      }}
      onPointerUp={() => { setTimeout(() => { drag.current = null }, 0) }}
      onPointerLeave={() => { drag.current = null }}
      onClickCapture={(e) => { if (drag.current?.moved) { e.stopPropagation(); e.preventDefault() } }}
    >
      {children}
    </div>
  )
}

/* ───────────────────────── chrome ───────────────────────── */

function StatusBar() {
  const time = useClock()
  return (
    <div className="zh-status">
      <span>{time}</span>
      <span className="zh-status-right"><Wifi /><Battery level={0.86} /></span>
    </div>
  )
}

function Toast({ message }: { message?: string }) {
  const [shown, setShown] = useState<string | null>(null)
  useEffect(() => {
    if (!message) return
    setShown(message)
    const t = setTimeout(() => setShown(null), 4500)
    return () => clearTimeout(t)
  }, [message])
  return <div className={`zh-toast ${shown ? 'on' : ''}`}>{shown?.toLowerCase()}</div>
}

function MediaOverlay({ open, onClose, onOpenNow }: { open: boolean; onClose(): void; onOpenNow(): void }) {
  const { playback } = useServices()
  const st = usePlaybackState(playback)
  useEffect(() => {
    if (!open) return
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [open, onClose, st.volume, st.paused])
  const t = st.track
  return (
    <div className={`zh-media ${open ? 'on' : ''}`}>
      <div className="zh-media-info" onClick={onOpenNow}>
        {t?.image && <img src={t.image} alt="" />}
        <div>
          <div className="zh-media-title">{t?.title ?? 'nothing playing'}</div>
          <div className="zh-media-artist">{t?.artist ?? ''}</div>
        </div>
      </div>
      <div className="zh-media-controls">
        <button className="zh-ring sm" onClick={() => playback.prev()} aria-label="previous"><PrevIcon /></button>
        <button className="zh-ring sm" onClick={() => playback.toggle()} aria-label="play or pause">{st.paused ? <PlayIcon /> : <PauseIcon />}</button>
        <button className="zh-ring sm" onClick={() => playback.next()} aria-label="next"><NextIcon /></button>
      </div>
      <div className="zh-media-vol">
        <span>volume</span>
        <input type="range" min={0} max={20} value={Math.round(st.volume * 20)} onChange={(e) => playback.setVolume(Number(e.target.value) / 20)} />
        <span className="zh-media-volnum">{Math.round(st.volume * 20)}</span>
      </div>
    </div>
  )
}

/* ───────────────────────── home ───────────────────────── */

const HOME_ITEMS = ['music', 'videos', 'pictures', 'radio', 'marketplace', 'internet', 'apps', 'settings'] as const

function Home({ ctx }: { ctx: Ctx }) {
  const { playback, library } = useServices()
  const st = usePlaybackState(playback)
  const panel = ctx.page.ui.pivot ?? 0
  const setPanel = (p: number) => ctx.nav.update({ pivot: Math.max(0, Math.min(1, p)) })
  const swipe = useSwipe((d) => setPanel(panel + d))
  const history = useAsync(panel === 1 ? `${library.kind}:hd:history:${ctx.page.id}` : null, () => library.history())
  const pins = useAsync(panel === 1 ? `${library.kind}:playlists` : null, () => library.playlists())

  useHandler(ctx, (a) => {
    if (a === 'right' || a === 'left') { setPanel(panel + (a === 'right' ? 1 : -1)); return true }
    if (a === 'back' && panel === 1) { setPanel(0); return true }
    return false
  })

  const go = (id: (typeof HOME_ITEMS)[number]) => {
    if (id === 'music' || id === 'marketplace' || id === 'settings') ctx.nav.push({ t: id })
    else {
      const text: Record<string, string> = {
        videos: 'no videos. spotify handles the music; the zune hd\'s hdmi dock is on vacation.',
        pictures: 'no pictures on this zune.',
        radio: 'hd radio needs headphones and a real tuner. try spotify radio from marketplace instead.',
        internet: 'the zune hd browser has retired. you\'re already on the internet, anyway.',
        apps: 'no apps installed. hexic and lucky penny send their regards.',
      }
      ctx.nav.push({ t: 'message', title: id, text: text[id] })
    }
  }

  const histItems = (history.data ?? []).slice(0, 9)
  const pinItems = (pins.data ?? []).slice(0, 6)
  return (
    <div className="zh-home" {...swipe}>
      <div className="zh-pano" style={{ transform: `translateX(${-panel * 256}px)` }}>
        <div className="zh-home-menu">
          {HOME_ITEMS.map((id, i) => (
            <div key={id} className="zh-home-item" style={{ animationDelay: `${i * 28}ms` }} onClick={() => go(id)}>{id}</div>
          ))}
          <button className="zh-home-arrow" onClick={() => setPanel(1)} aria-label="quickplay"><ArrowRightCircle /></button>
        </div>
        <div className="zh-quick">
          <div className="zh-quick-head">history</div>
          <div className="zh-tiles">
            {histItems.map((t) => (
              <div key={t.uri} className="zh-tile" onClick={() => ctx.open(t, histItems)}>
                {t.image ? <img src={t.image} alt="" /> : <span>{t.title}</span>}
              </div>
            ))}
            {!history.loading && !histItems.length && <div className="zh-dim">nothing played yet</div>}
          </div>
          <div className="zh-quick-head">pins</div>
          <div className="zh-pins">
            {pinItems.map((p) => (
              <div key={p.id} className="zh-pin" onClick={() => ctx.open(p, pinItems)}>{p.title.toLowerCase()}</div>
            ))}
          </div>
        </div>
      </div>
      {st.track && (
        <div className="zh-home-now" onClick={() => ctx.nav.push({ t: 'now' })}>
          {st.paused ? <PauseIcon width={10} height={10} /> : <PlayIcon width={10} height={10} />}
          <span className="zh-home-now-title">{st.track.title}</span>
          <span className="zh-home-now-artist">{st.track.artist}</span>
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── pivots & lists ───────────────────────── */

function Pivot({ labels, index, onPick }: { labels: string[]; index: number; onPick(i: number): void }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([])
  const [x, setX] = useState(0)
  useLayoutEffect(() => { setX(refs.current[index]?.offsetLeft ?? 0) }, [index, labels.length])
  return (
    <div className="zh-pivot">
      <div className="zh-pivot-track" style={{ transform: `translateX(${-x}px)` }}>
        {labels.map((l, i) => (
          <span key={l} ref={(el) => { refs.current[i] = el }} className={i === index ? 'sel' : ''} onClick={() => onPick(i)}>{l}</span>
        ))}
      </div>
    </div>
  )
}

type Variant = 'artist' | 'album' | 'song' | 'track' | 'playlist'

function ListRows({ items, variant, onPick }: { items: Item[]; variant: Variant; onPick(i: number): void }) {
  return (
    <>
      {items.map((it, i) => (
        <div key={it.id + i} className={`zh-row zh-row-${variant}`} style={{ animationDelay: `${Math.min(i, 10) * 22}ms` }} onClick={() => onPick(i)}>
          {(variant === 'album' || variant === 'playlist') && (
            <div className="zh-row-art">{it.image && <img src={it.image} alt="" loading="lazy" />}</div>
          )}
          {variant === 'track' && <div className="zh-row-num">{it.trackNumber ?? i + 1}</div>}
          <div className="zh-row-text">
            <div className="zh-row-title">{variant === 'artist' ? it.title.toLowerCase() : it.title}</div>
            {variant !== 'artist' && variant !== 'track' && it.subtitle && <div className="zh-row-sub">{it.subtitle}</div>}
          </div>
          {(variant === 'track' || variant === 'song') && it.durationMs ? <div className="zh-row-dur">{fmtTime(it.durationMs)}</div> : null}
        </div>
      ))}
    </>
  )
}

function Status({ loading, error, empty }: { loading?: boolean; error?: string; empty?: string }) {
  if (loading) return <div className="zh-loading"><i /><i /><i /><i /><i /></div>
  if (error) return <div className="zh-dim pad">{error.toLowerCase()}</div>
  if (empty) return <div className="zh-dim pad">{empty}</div>
  return null
}

const MUSIC_PIVOTS = ['artists', 'albums', 'songs', 'playlists', 'podcasts'] as const
const MUSIC_VARIANT: Record<(typeof MUSIC_PIVOTS)[number], Variant> = {
  artists: 'artist', albums: 'album', songs: 'song', playlists: 'playlist', podcasts: 'album',
}

function Music({ ctx }: { ctx: Ctx }) {
  const { library } = useServices()
  const pivot = ctx.page.ui.pivot ?? 0
  const name = MUSIC_PIVOTS[pivot]
  const res = useAsync(`${library.kind}:music:${name}`, () => library[name]())
  const items = res.data ?? []
  const setPivot = (p: number) => ctx.nav.update({ pivot: (p + MUSIC_PIVOTS.length) % MUSIC_PIVOTS.length })
  const swipe = useSwipe((d) => setPivot(pivot + d))
  useHandler(ctx, (a) => {
    if (a === 'left' || a === 'right') { setPivot(pivot + (a === 'right' ? 1 : -1)); return true }
    return false
  })
  return (
    <div className="zh-col" {...swipe}>
      <Pivot labels={[...MUSIC_PIVOTS]} index={pivot} onPick={setPivot} />
      <DragScroll key={name} className="zh-pivot-body">
        <Status loading={res.loading} error={res.error} empty={!res.loading && !res.error && !items.length ? `no ${name}` : undefined} />
        <ListRows items={items} variant={MUSIC_VARIANT[name]} onPick={(i) => ctx.open(items[i], items)} />
      </DragScroll>
    </div>
  )
}

function Collection({ ctx, item }: { ctx: Ctx; item: Item }) {
  const { library, playback } = useServices()
  const res = useAsync(`${library.kind}:${item.kind}:${item.id}`, () =>
    item.kind === 'artist' ? library.artistAlbums(item)
      : item.kind === 'album' ? library.albumTracks(item)
        : item.kind === 'playlist' ? library.playlistTracks(item)
          : library.showEpisodes(item))
  const items = res.data ?? []
  const contextUri = item.kind === 'artist' ? undefined : item.uri
  useHandler(ctx, () => false)

  const playAll = (shuffle: boolean) => {
    if (!items.length) return
    playback.setShuffle(shuffle)
    const first = shuffle ? items[Math.floor(Math.random() * items.length)] : items[0]
    ctx.open(first, items, contextUri)
  }

  const kicker = item.kind === 'show' ? 'podcast' : item.kind
  return (
    <div className="zh-col">
      <DragScroll className="zh-detail">
        <div className="zh-detail-kicker">{kicker}</div>
        <div className="zh-detail-title">{item.title.toLowerCase()}</div>
        {item.kind !== 'artist' && (
          <div className="zh-detail-hero">
            <div className="zh-detail-art">{item.imageLarge && <img src={item.imageLarge} alt="" />}</div>
            <div className="zh-detail-meta">
              {item.subtitle && <div className="zh-detail-by">{item.subtitle}</div>}
              {item.year && <div className="zh-dim">{item.year}</div>}
              <div className="zh-dim">{items.length || item.count || 0} {item.kind === 'show' ? 'episodes' : 'songs'}</div>
              <div className="zh-detail-actions">
                <button onClick={() => playAll(false)}>play</button>
                <button onClick={() => playAll(true)}>shuffle</button>
              </div>
            </div>
          </div>
        )}
        {item.kind === 'artist' && <div className="zh-section">albums</div>}
        <Status loading={res.loading} error={res.error} empty={!res.loading && !res.error && !items.length ? 'nothing here' : undefined} />
        <ListRows
          items={items}
          variant={item.kind === 'artist' ? 'album' : item.kind === 'album' ? 'track' : 'song'}
          onPick={(i) => ctx.open(items[i], items, contextUri)}
        />
      </DragScroll>
    </div>
  )
}

/* ───────────────────────── now playing ───────────────────────── */

const REPEAT_NEXT: Record<Repeat, Repeat> = { off: 'context', context: 'track', track: 'off' }

function NowPlaying({ ctx }: { ctx: Ctx }) {
  const { playback } = useServices()
  const st = usePlaybackState(playback)
  const pos = usePosition(st)
  const [controls, setControls] = useState(true)
  const hideTimer = useRef<number | undefined>(undefined)
  const t = st.track

  const poke = () => {
    setControls(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControls(false), 4500)
  }
  useEffect(() => { poke(); return () => clearTimeout(hideTimer.current) }, [])
  const swipe = useSwipe((d) => { if (d > 0) playback.next(); else playback.prev(); poke() })

  useHandler(ctx, (a) => {
    if (a === 'left') { playback.prev(); poke(); return true }
    if (a === 'right') { playback.next(); poke(); return true }
    if (a === 'up') { playback.setVolume(st.volume + 0.05); return true }
    if (a === 'down') { playback.setVolume(st.volume - 0.05); return true }
    if (a === 'select') { poke(); return true }
    return false
  })

  if (!t) {
    return (
      <div className="zh-now empty" onClick={() => ctx.nav.pop()}>
        <div className="zh-detail-title">nothing playing</div>
        <div className="zh-dim">tap to go back</div>
      </div>
    )
  }

  const pct = t.durationMs ? (pos / t.durationMs) * 100 : 0
  const seekFrom = (e: RPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    playback.seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * t.durationMs)
    poke()
  }
  return (
    <div className={`zh-now ${controls ? 'show' : ''}`} onClick={poke} {...swipe}>
      <div className="zh-now-bg" key={t.imageLarge}>
        {t.imageLarge && <img src={t.imageLarge} alt="" />}
        {t.imageLarge && <img src={t.imageLarge} alt="" />}
      </div>
      <div className="zh-now-shade" />
      <div className="zh-now-marquee" key={t.artist}>
        <span>{t.artist.toLowerCase()}</span><span>{t.artist.toLowerCase()}</span>
      </div>
      <div className="zh-now-top">
        <div className="zh-now-art">{t.image && <img src={t.image} alt="" />}</div>
        <div className="zh-now-text" key={t.uri}>
          <div className="zh-now-artist">{t.artist}</div>
          <div className="zh-now-album">{t.album}</div>
          <div className="zh-now-title">{t.title}</div>
        </div>
      </div>
      {st.next[0] && <div className="zh-now-next"><span>next</span> {st.next[0].title}</div>}
      <div className="zh-now-controls" onClick={(e) => { e.stopPropagation(); poke() }}>
        <div className="zh-scrub" onPointerDown={seekFrom}>
          <div className="zh-scrub-bar"><div style={{ width: `${pct}%` }} /><i style={{ left: `${pct}%` }} /></div>
          <div className="zh-scrub-times"><span>{fmtTime(pos)}</span><span>-{fmtTime(t.durationMs - pos)}</span></div>
        </div>
        <div className="zh-now-buttons">
          <button className={`zh-toggle ${st.shuffle ? 'on' : ''}`} onClick={() => playback.setShuffle(!st.shuffle)} aria-label="shuffle"><ShuffleIcon /></button>
          <button className="zh-ring" onClick={() => playback.prev()} aria-label="previous"><PrevIcon /></button>
          <button className="zh-ring lg" onClick={() => playback.toggle()} aria-label="play or pause">{st.paused ? <PlayIcon /> : <PauseIcon />}</button>
          <button className="zh-ring" onClick={() => playback.next()} aria-label="next"><NextIcon /></button>
          <button className={`zh-toggle ${st.repeat !== 'off' ? 'on' : ''}`} onClick={() => playback.setRepeat(REPEAT_NEXT[st.repeat])} aria-label="repeat"><RepeatIcon one={st.repeat === 'track'} /></button>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── marketplace / settings ───────────────────────── */

const SEARCH_PIVOTS = ['search', 'songs', 'albums', 'artists', 'playlists'] as const

function Marketplace({ ctx }: { ctx: Ctx }) {
  const { library } = useServices()
  const ui = ctx.page.ui
  const pivot = ui.pivot ?? 0
  const [draft, setDraft] = useState(ui.q ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const res = useAsync<SearchResults>(ui.submitted ? `${library.kind}:search:${ui.submitted}` : null, () => library.search(ui.submitted!))
  const key = SEARCH_PIVOTS[pivot]
  const items: Item[] = key === 'search' ? [] : res.data?.[key] ?? []
  const setPivot = (p: number) => { if (ui.submitted) ctx.nav.update({ pivot: (p + SEARCH_PIVOTS.length) % SEARCH_PIVOTS.length }) }
  const swipe = useSwipe((d) => setPivot(pivot + d))
  useHandler(ctx, (a) => {
    if (a === 'left' || a === 'right') { setPivot(pivot + (a === 'right' ? 1 : -1)); return true }
    return false
  })
  useEffect(() => { if (pivot === 0 && !ui.submitted) inputRef.current?.focus() }, [pivot, ui.submitted])

  const submit = () => {
    if (!draft.trim()) return
    ctx.nav.update({ q: draft, submitted: draft.trim(), pivot: 1 })
    inputRef.current?.blur()
  }
  return (
    <div className="zh-col" {...swipe}>
      <Pivot labels={[...SEARCH_PIVOTS]} index={pivot} onPick={setPivot} />
      <DragScroll key={pivot} className="zh-pivot-body">
        {pivot === 0 ? (
          <div className="zh-search">
            <div className="zh-search-box">
              <input
                ref={inputRef}
                value={draft}
                placeholder="search spotify"
                spellCheck={false}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') submit(); if (e.key === 'Escape') inputRef.current?.blur() }}
              />
              <button onClick={submit}>go</button>
            </div>
            <div className="zh-dim">songs, albums, artists and playlists from the spotify catalog.</div>
          </div>
        ) : (
          <>
            <Status loading={res.loading} error={res.error} empty={!res.loading && !items.length ? `no ${key} found` : undefined} />
            <ListRows items={items} variant={key === 'songs' ? 'song' : key === 'artists' ? 'artist' : key === 'playlists' ? 'playlist' : 'album'} onPick={(i) => ctx.open(items[i], items)} />
          </>
        )}
      </DragScroll>
    </div>
  )
}

function Settings({ ctx }: { ctx: Ctx }) {
  const svc = useServices()
  const profile = useAsync(svc.signedIn ? 'spotify:profile' : null, () => svc.library.profile())
  useHandler(ctx, () => false)
  const model = MODELS.find((m) => m.id === svc.model)!
  const rows: { title: string; sub: string; act(): void }[] = [
    {
      title: 'spotify',
      sub: svc.signedIn ? `signed in${profile.data ? ` as ${profile.data.name}` : ''} — tap to sign out`
        : svc.hasClientId ? 'tap to sign in' : 'add a client id beside the device first',
      act: () => (svc.signedIn ? svc.signOut() : svc.signIn()),
    },
    {
      title: 'device', sub: model.name,
      act: () => svc.setModel(MODELS[(MODELS.findIndex((m) => m.id === svc.model) + 1) % MODELS.length].id),
    },
    {
      title: 'about', sub: 'zune player for spotify',
      act: () => ctx.nav.push({ t: 'message', title: 'about', text: 'a tribute to the microsoft zune hd, streaming from spotify. not affiliated with microsoft or spotify.' }),
    },
  ]
  return (
    <div className="zh-col">
      <Pivot labels={['settings']} index={0} onPick={() => {}} />
      <DragScroll className="zh-pivot-body">
        {rows.map((r, i) => (
          <div key={r.title} className="zh-row zh-row-setting" style={{ animationDelay: `${i * 30}ms` }} onClick={r.act}>
            <div className="zh-row-text">
              <div className="zh-row-title">{r.title}</div>
              <div className="zh-row-sub">{r.sub}</div>
            </div>
          </div>
        ))}
      </DragScroll>
    </div>
  )
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="zh-col">
      <Pivot labels={[title]} index={0} onPick={() => {}} />
      <div className="zh-message">{text}</div>
    </div>
  )
}
