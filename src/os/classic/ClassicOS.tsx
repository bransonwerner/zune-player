// The Zune firmware UI (v2/v3 era) used by the Zune 30 and Zune 80/120:
// huge lowercase menus, sliding pivots, dim unselected items, 240×320 portrait.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useInput } from '../../lib/input'
import { MODELS, useAsync, useClock, useServices } from '../../lib/services'
import { moveSel, useStack, type Handler, type Nav, type Page } from '../../lib/stack'
import { Battery, PauseIcon, PlayIcon, RepeatIcon, ShuffleIcon, Wifi } from '../../lib/icons'
import { fmtTime, playRequestFor, type Item, type SearchResults } from '../../library/types'
import { usePlaybackState, usePosition, type Repeat } from '../../playback/types'
import './classic.css'

type CKind =
  | { t: 'main' }
  | { t: 'music' }
  | { t: 'collection'; item: Item }
  | { t: 'now' }
  | { t: 'social' }
  | { t: 'podcasts' }
  | { t: 'marketplace' }
  | { t: 'settings' }
  | { t: 'message'; title: string; text: string }

interface Ctx {
  nav: Nav<CKind>
  page: Page<CKind>
  setHandler(h: Handler | null): void
  open(item: Item, list: Item[], contextUri?: string): void
  wallpaper: number
  setWallpaper(n: number): void
}

const WALLPAPERS = ['zune', 'flow', 'sunset', 'black']

export function ClassicOS() {
  const svc = useServices()
  const { playback } = svc
  const st = usePlaybackState(playback)
  const nav = useStack<CKind>({ t: 'main' })
  const handler = useRef<Handler | null>(null)
  const [wallpaper, setWallpaperState] = useState(() => Number(localStorage.getItem('zune.classic.wall') ?? 0) || 0)
  const setWallpaper = (n: number) => {
    setWallpaperState(n)
    localStorage.setItem('zune.classic.wall', String(n))
  }

  useInput((a) => {
    if (handler.current?.(a)) return
    if (a === 'back') nav.pop()
    else if (a === 'home') nav.home()
    else if (a === 'playpause') playback.toggle()
    else if (a === 'volup') playback.setVolume(st.volume + 0.05)
    else if (a === 'voldown') playback.setVolume(st.volume - 0.05)
  })

  const ctx: Ctx = {
    nav,
    page: nav.top,
    setHandler: (h) => { handler.current = h },
    wallpaper,
    setWallpaper,
    open(item, list, contextUri) {
      if (item.kind === 'track' || item.kind === 'episode') {
        playback.play(playRequestFor(list, item, contextUri))
        nav.push({ t: 'now' })
      } else {
        nav.push({ t: 'collection', item })
      }
    },
  }

  const k = nav.top.kind
  const isNow = k.t === 'now'
  return (
    <div className="zc">
      <div className={`zc-wall zc-wall-${WALLPAPERS[wallpaper] ?? 'zune'}`} />
      <StatusBar playing={!!st.track && !st.paused} />
      <div key={nav.top.id} className={`zc-page zc-${nav.dir} ${isNow ? 'zc-page-now' : ''}`}>
        <PageSwitch ctx={ctx} />
      </div>
      <VolumeOverlay volume={st.volume} />
      <Toast message={st.message} />
    </div>
  )
}

function PageSwitch({ ctx }: { ctx: Ctx }) {
  const k = ctx.page.kind
  switch (k.t) {
    case 'main': return <MainMenu ctx={ctx} />
    case 'music': return <MusicPage ctx={ctx} />
    case 'collection': return <CollectionPage ctx={ctx} item={k.item} />
    case 'now': return <NowPlaying ctx={ctx} />
    case 'social': return <SocialPage ctx={ctx} />
    case 'podcasts': return <PodcastsPage ctx={ctx} />
    case 'marketplace': return <MarketplacePage ctx={ctx} />
    case 'settings': return <SettingsPage ctx={ctx} />
    case 'message': return <MessagePage ctx={ctx} title={k.title} text={k.text} />
  }
}

/** Registers the page's input handler for as long as it's on top. */
function useHandler(ctx: Ctx, h: Handler) {
  const ref = useRef(h)
  ref.current = h
  useEffect(() => {
    ctx.setHandler((a) => ref.current(a))
    return () => ctx.setHandler(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/* ───────────────────────── chrome ───────────────────────── */

function StatusBar({ playing }: { playing: boolean }) {
  const time = useClock()
  return (
    <div className="zc-status">
      <span className="zc-status-play">{playing ? <PlayIcon width={8} height={8} /> : null}</span>
      <span className="zc-status-right">
        <Wifi />
        <span className="zc-clock">{time}</span>
        <Battery level={0.78} />
      </span>
    </div>
  )
}

function VolumeOverlay({ volume }: { volume: number }) {
  const [shown, setShown] = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setShown(true)
    const t = setTimeout(() => setShown(false), 1300)
    return () => clearTimeout(t)
  }, [volume])
  const steps = Math.round(volume * 20)
  return (
    <div className={`zc-volume ${shown ? 'on' : ''}`}>
      <div className="zc-volume-num">{steps}</div>
      <div className="zc-volume-bars">
        {Array.from({ length: 20 }, (_, i) => <i key={i} className={i < steps ? 'on' : ''} />)}
      </div>
      <div className="zc-volume-label">volume</div>
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
  return <div className={`zc-toast ${shown ? 'on' : ''}`}>{shown?.toLowerCase()}</div>
}

/* ───────────────────────── building blocks ───────────────────────── */

interface Row { key: string; title: string; subtitle?: string; image?: string; meta?: string }
type Variant = 'plain' | 'song' | 'album'
const ROW_H: Record<Variant, number> = { plain: 31, song: 39, album: 50 }

const toRow = (i: Item): Row => ({
  key: i.id + i.uri, title: i.title, subtitle: i.subtitle, image: i.image,
  meta: i.durationMs && i.kind === 'track' ? fmtTime(i.durationMs) : undefined,
})

function CList({ rows, sel, variant, onPick }: {
  rows: Row[]; sel: number; variant: Variant; onPick?(i: number): void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [h, setH] = useState(0)
  const scroll = useRef<number | null>(null)
  useLayoutEffect(() => { setH(box.current?.clientHeight ?? 0) }, [])
  const rh = ROW_H[variant]
  if (h) {
    const top = sel * rh
    let s = scroll.current ?? top - h / 2 + rh / 2
    if (top < s + rh * 0.5 && sel > 0) s = top - rh * 0.5
    if (top < s) s = top
    if (top + rh > s + h - rh * 0.5 && sel < rows.length - 1) s = top + rh * 1.5 - h
    scroll.current = Math.min(Math.max(0, s), Math.max(0, rows.length * rh - h))
  }
  return (
    <div className="zc-list" ref={box}>
      <div className="zc-list-track" style={{ transform: `translateY(${-(scroll.current ?? 0)}px)` }}>
        {rows.map((r, i) => (
          <div
            key={r.key + i}
            className={`zc-row zc-row-${variant} ${i === sel ? 'sel' : ''}`}
            style={{ height: rh }}
            onClick={() => onPick?.(i)}
          >
            {variant === 'album' && (
              <div className="zc-thumb">{r.image ? <img src={r.image} alt="" /> : null}</div>
            )}
            <div className="zc-row-text">
              <div className="zc-row-title">{r.title}</div>
              {variant !== 'plain' && r.subtitle && <div className="zc-row-sub">{r.subtitle}</div>}
            </div>
            {r.meta && variant === 'song' && <div className="zc-row-meta">{r.meta}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Pivot({ labels, index }: { labels: string[]; index: number }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([])
  const [x, setX] = useState(0)
  useLayoutEffect(() => { setX(refs.current[index]?.offsetLeft ?? 0) }, [index, labels.length])
  return (
    <div className="zc-pivot">
      <div className="zc-pivot-track" style={{ transform: `translateX(${-x}px)` }}>
        {labels.map((l, i) => (
          <span key={l} ref={(el) => { refs.current[i] = el }} className={i === index ? 'sel' : ''}>{l}</span>
        ))}
      </div>
    </div>
  )
}

function Status({ loading, error, empty }: { loading?: boolean; error?: string; empty?: string }) {
  if (loading) return <div className="zc-note">loading<span className="zc-dots"><i>.</i><i>.</i><i>.</i></span></div>
  if (error) return <div className="zc-note">{error.toLowerCase()}</div>
  if (empty) return <div className="zc-note">{empty}</div>
  return null
}

function Header({ kicker, title, sub, image }: { kicker: string; title: string; sub?: string; image?: string }) {
  return (
    <div className={`zc-head ${image ? 'with-art' : ''}`}>
      {image && <img className="zc-head-art" src={image} alt="" />}
      <div className="zc-head-text">
        <div className="zc-kicker">{kicker}</div>
        <div className="zc-head-title">{title.toLowerCase()}</div>
        {sub && <div className="zc-head-sub">{sub}</div>}
      </div>
    </div>
  )
}

/** Shared list-page input: up/down selection, select opens. */
function listHandler(ctx: Ctx, sel: number, len: number, onSelect: () => void): Handler {
  return (a) => {
    const n = moveSel(a, sel, len)
    if (n !== null) { ctx.nav.update({ sel: n }); return true }
    if (a === 'select' || a === 'right') { if (len) onSelect(); return true }
    return false
  }
}

/* ───────────────────────── pages ───────────────────────── */

const MAIN_ITEMS: { id: string; label: string; hint: string }[] = [
  { id: 'music', label: 'music', hint: 'artists  albums  songs  playlists' },
  { id: 'videos', label: 'videos', hint: 'tv  music videos  movies' },
  { id: 'pictures', label: 'pictures', hint: 'folders  dates' },
  { id: 'social', label: 'social', hint: 'me  history' },
  { id: 'radio', label: 'radio', hint: 'fm' },
  { id: 'podcasts', label: 'podcasts', hint: 'series' },
  { id: 'marketplace', label: 'marketplace', hint: 'search spotify' },
  { id: 'settings', label: 'settings', hint: 'account  device  background' },
]

function MainMenu({ ctx }: { ctx: Ctx }) {
  const { playback } = useServices()
  const st = usePlaybackState(playback)
  const items = st.track
    ? [{ id: 'now', label: 'now playing', hint: `${st.track.title} – ${st.track.artist}` }, ...MAIN_ITEMS]
    : MAIN_ITEMS
  const sel = Math.min(ctx.page.ui.sel ?? 0, items.length - 1)

  const go = (id: string) => {
    const nav = ctx.nav
    if (id === 'now') nav.push({ t: 'now' })
    else if (id === 'music' || id === 'social' || id === 'podcasts' || id === 'marketplace' || id === 'settings')
      nav.push({ t: id })
    else if (id === 'videos')
      nav.push({ t: 'message', title: 'videos', text: 'there are no videos on your zune. spotify brings the music — videos stay in 2008.' })
    else if (id === 'pictures')
      nav.push({ t: 'message', title: 'pictures', text: 'there are no pictures on your zune.' })
    else if (id === 'radio')
      nav.push({ t: 'message', title: 'radio', text: 'no signal. plug in your headphones — they\'re the antenna. (fm radio isn\'t available on the web.)' })
  }

  useHandler(ctx, listHandler(ctx, sel, items.length, () => go(items[sel].id)))

  const ROW = 41
  const offset = Math.max(0, Math.min(sel * ROW - 96, items.length * ROW + 18 - 280))
  return (
    <div className="zc-main">
      <div className="zc-main-track" style={{ transform: `translateY(${-offset}px)` }}>
        {items.map((it, i) => (
          <div key={it.id} className={`zc-main-item ${i === sel ? 'sel' : ''}`} onClick={() => { ctx.nav.update({ sel: i }); go(it.id) }}>
            <div className="zc-main-label">{it.label}</div>
            <div className="zc-main-hint">{it.hint}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const MUSIC_PIVOTS = ['artists', 'albums', 'songs', 'playlists'] as const

function MusicPage({ ctx }: { ctx: Ctx }) {
  const { library } = useServices()
  const pivot = ctx.page.ui.pivot ?? 0
  const sels = ctx.page.ui.sels ?? [0, 0, 0, 0]
  const name = MUSIC_PIVOTS[pivot]
  const res = useAsync(`${library.kind}:music:${name}`, () => library[name]())
  const items = res.data ?? []
  const sel = Math.min(sels[pivot] ?? 0, Math.max(0, items.length - 1))

  useHandler(ctx, (a) => {
    if (a === 'left' || a === 'right') {
      const p = (pivot + (a === 'right' ? 1 : -1) + MUSIC_PIVOTS.length) % MUSIC_PIVOTS.length
      ctx.nav.update({ pivot: p })
      return true
    }
    const n = moveSel(a, sel, items.length)
    if (n !== null) {
      const next = [...sels]; next[pivot] = n
      ctx.nav.update({ sels: next })
      return true
    }
    if (a === 'select' && items[sel]) { ctx.open(items[sel], items); return true }
    return false
  })

  const variant: Variant = name === 'albums' ? 'album' : name === 'songs' ? 'song' : 'plain'
  return (
    <div className="zc-col">
      <Pivot labels={[...MUSIC_PIVOTS]} index={pivot} />
      <div key={name} className="zc-pivot-body">
        <Status loading={res.loading} error={res.error} empty={!res.loading && !res.error && !items.length ? `no ${name}` : undefined} />
        {!!items.length && (
          <CList rows={items.map(toRow)} sel={sel} variant={variant} onPick={(i) => {
            const next = [...sels]; next[pivot] = i
            ctx.nav.update({ sels: next })
            ctx.open(items[i], items)
          }} />
        )}
      </div>
    </div>
  )
}

function CollectionPage({ ctx, item }: { ctx: Ctx; item: Item }) {
  const { library } = useServices()
  const res = useAsync(`${library.kind}:${item.kind}:${item.id}`, () =>
    item.kind === 'artist' ? library.artistAlbums(item)
      : item.kind === 'album' ? library.albumTracks(item)
        : item.kind === 'playlist' ? library.playlistTracks(item)
          : library.showEpisodes(item))
  const items = res.data ?? []
  const sel = Math.min(ctx.page.ui.sel ?? 0, Math.max(0, items.length - 1))
  const contextUri = item.kind === 'artist' ? undefined : item.uri

  useHandler(ctx, listHandler(ctx, sel, items.length, () => ctx.open(items[sel], items, contextUri)))

  const kicker = item.kind === 'show' ? 'podcast' : item.kind
  const sub = item.kind === 'album' ? [item.subtitle, item.year].filter(Boolean).join(' · ')
    : item.kind === 'playlist' ? `${items.length || item.count || 0} songs`
      : item.kind === 'show' ? item.subtitle : `${items.length} albums`
  const rows = item.kind === 'album'
    ? items.map((t) => ({ ...toRow(t), title: `${t.trackNumber ?? ''}  ${t.title}`.trim(), subtitle: undefined }))
    : items.map(toRow)
  return (
    <div className="zc-col">
      <Header kicker={kicker} title={item.title} sub={sub} image={item.kind === 'artist' ? undefined : item.image} />
      <Status loading={res.loading} error={res.error} empty={!res.loading && !res.error && !items.length ? 'nothing here' : undefined} />
      {!!items.length && (
        <CList rows={rows} sel={sel} variant={item.kind === 'artist' ? 'album' : item.kind === 'album' ? 'plain' : 'song'}
          onPick={(i) => { ctx.nav.update({ sel: i }); ctx.open(items[i], items, contextUri) }} />
      )}
    </div>
  )
}

const REPEAT_NEXT: Record<Repeat, Repeat> = { off: 'context', context: 'track', track: 'off' }
const REPEAT_LABEL: Record<Repeat, string> = { off: 'off', context: 'all', track: 'one' }

function NowPlaying({ ctx }: { ctx: Ctx }) {
  const { playback } = useServices()
  const st = usePlaybackState(playback)
  const pos = usePosition(st)
  const [menu, setMenu] = useState<number | null>(null)
  const [flash, setFlash] = useState(0)
  const t = st.track

  useHandler(ctx, (a) => {
    if (menu !== null) {
      if (a === 'up' || a === 'down') { setMenu((m) => ((m ?? 0) + 1) % 2); return true }
      if (a === 'select' || a === 'right' || a === 'left') {
        if (menu === 0) playback.setShuffle(!st.shuffle)
        else playback.setRepeat(REPEAT_NEXT[st.repeat])
        return true
      }
      if (a === 'back') { setMenu(null); return true }
      return false
    }
    if (a === 'left') { playback.prev(); return true }
    if (a === 'right') { playback.next(); return true }
    if (a === 'up') { playback.setVolume(st.volume + 0.05); return true }
    if (a === 'down') { playback.setVolume(st.volume - 0.05); return true }
    if (a === 'select') { setMenu(0); return true }
    if (a === 'playpause') { playback.toggle(); setFlash((f) => f + 1); return true }
    return false
  })

  if (!t) {
    return (
      <div className="zc-col">
        <Header kicker="now playing" title="nothing's playing" />
        <div className="zc-note">pick a song from music to start listening.</div>
      </div>
    )
  }
  const pct = t.durationMs ? (pos / t.durationMs) * 100 : 0
  return (
    <div className="zc-now">
      <div className="zc-now-art" key={t.imageLarge}>
        {t.imageLarge && <img src={t.imageLarge} alt="" />}
      </div>
      <div className="zc-now-shade" />
      <div className="zc-now-info" key={t.uri}>
        <div className="zc-now-artist">{t.artist}</div>
        <div className="zc-now-title">{t.title}</div>
        <div className="zc-now-album">{t.album}</div>
      </div>
      <div className="zc-now-bottom">
        <div className="zc-progress"><div style={{ width: `${pct}%` }} /></div>
        <div className="zc-times">
          <span>{fmtTime(pos)}</span>
          <span className="zc-now-flags">
            {st.shuffle && <ShuffleIcon width={11} height={11} />}
            {st.repeat !== 'off' && <RepeatIcon width={11} height={11} one={st.repeat === 'track'} />}
          </span>
          <span>-{fmtTime(t.durationMs - pos)}</span>
        </div>
        {st.next[0] && <div className="zc-next">next: {st.next[0].title}</div>}
      </div>
      <div key={flash} className={`zc-now-flash ${flash ? 'go' : ''}`}>
        {st.paused ? <PauseIcon width={34} height={34} /> : <PlayIcon width={34} height={34} />}
      </div>
      {menu !== null && (
        <div className="zc-now-menu">
          <div className={menu === 0 ? 'sel' : ''}>shuffle <b>{st.shuffle ? 'on' : 'off'}</b></div>
          <div className={menu === 1 ? 'sel' : ''}>repeat <b>{REPEAT_LABEL[st.repeat]}</b></div>
        </div>
      )}
    </div>
  )
}

function SocialPage({ ctx }: { ctx: Ctx }) {
  const { library, signedIn } = useServices()
  const pivot = ctx.page.ui.pivot ?? 0
  const profile = useAsync(`${library.kind}:profile`, () => library.profile())
  const hist = useAsync(pivot === 1 ? `${library.kind}:history:${ctx.page.id}` : null, () => library.history())
  const items = hist.data ?? []
  const sel = Math.min(ctx.page.ui.sel ?? 0, Math.max(0, items.length - 1))

  useHandler(ctx, (a) => {
    if (a === 'left' || a === 'right') { ctx.nav.update({ pivot: pivot ? 0 : 1, sel: 0 }); return true }
    if (pivot === 1) return listHandler(ctx, sel, items.length, () => ctx.open(items[sel], items))(a)
    return false
  })

  return (
    <div className="zc-col">
      <Pivot labels={['me', 'history']} index={pivot} />
      <div key={pivot} className="zc-pivot-body">
        {pivot === 0 ? (
          <div className="zc-me">
            <div className="zc-me-pic">
              {profile.data?.image ? <img src={profile.data.image} alt="" /> : <span>{(profile.data?.name ?? '?')[0]}</span>}
            </div>
            <div className="zc-me-name">{profile.data?.name?.toLowerCase() ?? '…'}</div>
            <div className="zc-me-sub">
              {signedIn ? `spotify ${profile.data?.product ?? ''}`.trim() : 'demo mode — connect spotify in settings'}
            </div>
          </div>
        ) : (
          <>
            <Status loading={hist.loading} error={hist.error} empty={!hist.loading && !items.length ? 'no recent plays' : undefined} />
            {!!items.length && <CList rows={items.map(toRow)} sel={sel} variant="song" onPick={(i) => ctx.open(items[i], items)} />}
          </>
        )}
      </div>
    </div>
  )
}

function PodcastsPage({ ctx }: { ctx: Ctx }) {
  const { library } = useServices()
  const res = useAsync(`${library.kind}:podcasts`, () => library.podcasts())
  const items = res.data ?? []
  const sel = Math.min(ctx.page.ui.sel ?? 0, Math.max(0, items.length - 1))
  useHandler(ctx, listHandler(ctx, sel, items.length, () => ctx.open(items[sel], items)))
  return (
    <div className="zc-col">
      <Pivot labels={['series']} index={0} />
      <div className="zc-pivot-body">
        <Status loading={res.loading} error={res.error} empty={!res.loading && !res.error && !items.length ? 'no podcasts. follow shows in spotify to see them here.' : undefined} />
        {!!items.length && <CList rows={items.map(toRow)} sel={sel} variant="album" onPick={(i) => ctx.open(items[i], items)} />}
      </div>
    </div>
  )
}

const SEARCH_PIVOTS = ['search', 'songs', 'albums', 'artists', 'playlists'] as const

function MarketplacePage({ ctx }: { ctx: Ctx }) {
  const { library } = useServices()
  const ui = ctx.page.ui
  const pivot = ui.pivot ?? 0
  const sels = ui.sels ?? [0, 0, 0, 0, 0]
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(ui.q ?? '')
  const res = useAsync<SearchResults>(ui.submitted ? `${library.kind}:search:${ui.submitted}` : null, () => library.search(ui.submitted!))
  const key = SEARCH_PIVOTS[pivot]
  const items: Item[] = key === 'search' ? [] : res.data?.[key] ?? []
  const sel = Math.min(sels[pivot] ?? 0, Math.max(0, items.length - 1))

  useEffect(() => { if (pivot === 0 && !ui.submitted) inputRef.current?.focus() }, [pivot, ui.submitted])

  useHandler(ctx, (a) => {
    if (a === 'left' || a === 'right') {
      if (!ui.submitted) return true
      ctx.nav.update({ pivot: (pivot + (a === 'right' ? 1 : -1) + SEARCH_PIVOTS.length) % SEARCH_PIVOTS.length })
      return true
    }
    if (pivot === 0) {
      if (a === 'select') { inputRef.current?.focus(); return true }
      return false
    }
    const n = moveSel(a, sel, items.length)
    if (n !== null) { const s = [...sels]; s[pivot] = n; ctx.nav.update({ sels: s }); return true }
    if (a === 'select' && items[sel]) { ctx.open(items[sel], items); return true }
    return false
  })

  return (
    <div className="zc-col">
      <Pivot labels={[...SEARCH_PIVOTS]} index={pivot} />
      <div key={pivot} className="zc-pivot-body">
        {pivot === 0 ? (
          <div className="zc-search">
            <div className="zc-search-label">search spotify</div>
            <input
              ref={inputRef}
              className="zc-input"
              value={draft}
              spellCheck={false}
              placeholder="type with your keyboard"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter' && draft.trim()) {
                  ctx.nav.update({ q: draft, submitted: draft.trim(), pivot: 1, sels: [0, 0, 0, 0, 0] })
                  inputRef.current?.blur()
                } else if (e.key === 'Escape' || e.key === 'ArrowDown') {
                  inputRef.current?.blur()
                }
              }}
            />
            <div className="zc-search-help">press enter to search · ← → to browse results</div>
          </div>
        ) : (
          <>
            <Status loading={res.loading} error={res.error} empty={!res.loading && !items.length ? `no ${key} found` : undefined} />
            {!!items.length && (
              <CList rows={items.map(toRow)} sel={sel} variant={key === 'songs' ? 'song' : key === 'artists' ? 'plain' : 'album'}
                onPick={(i) => ctx.open(items[i], items)} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SettingsPage({ ctx }: { ctx: Ctx }) {
  const svc = useServices()
  const model = MODELS.find((m) => m.id === svc.model)!
  const rows: (Row & { act(): void })[] = [
    {
      key: 'spotify', title: 'spotify',
      subtitle: svc.signedIn ? 'connected — select to sign out' : svc.hasClientId ? 'select to sign in' : 'add a client id beside the device',
      act: () => (svc.signedIn ? svc.signOut() : svc.signIn()),
    },
    {
      key: 'device', title: 'device', subtitle: model.name,
      act: () => {
        const i = MODELS.findIndex((m) => m.id === svc.model)
        svc.setModel(MODELS[(i + 1) % MODELS.length].id)
      },
    },
    {
      key: 'bg', title: 'background', subtitle: WALLPAPERS[ctx.wallpaper],
      act: () => ctx.setWallpaper((ctx.wallpaper + 1) % WALLPAPERS.length),
    },
    {
      key: 'about', title: 'about', subtitle: 'zune player for spotify',
      act: () => ctx.nav.push({ t: 'message', title: 'about', text: 'a tribute to the microsoft zune, streaming from spotify. not affiliated with microsoft or spotify. welcome to the social.' }),
    },
  ]
  const sel = Math.min(ctx.page.ui.sel ?? 0, rows.length - 1)
  useHandler(ctx, listHandler(ctx, sel, rows.length, () => rows[sel].act()))
  return (
    <div className="zc-col">
      <Pivot labels={['settings']} index={0} />
      <div className="zc-pivot-body">
        <CList rows={rows} sel={sel} variant="song" onPick={(i) => { ctx.nav.update({ sel: i }); rows[i].act() }} />
      </div>
    </div>
  )
}

function MessagePage({ ctx, title, text }: { ctx: Ctx; title: string; text: ReactNode }) {
  useHandler(ctx, () => false)
  return (
    <div className="zc-col">
      <Pivot labels={[title]} index={0} />
      <div className="zc-message">{text}</div>
    </div>
  )
}

