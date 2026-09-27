// A small fictional library so the interface is fully explorable before
// connecting Spotify. Nothing here makes network requests or plays audio.

import { byTitle, type Item, type Library } from './types'

const PALETTES = [
  ['#f7941d', '#ec008c'], ['#00a3e0', '#1b1464'], ['#8dc63f', '#006837'], ['#ed1c24', '#2e0a0a'],
  ['#fbb040', '#8b5e3c'], ['#9e1f63', '#262262'], ['#27aae1', '#9ecfe8'], ['#c2b59b', '#3c2415'],
  ['#ee2a7b', '#ff9a8b'], ['#39b54a', '#0f2e14'], ['#662d91', '#ec008c'], ['#f15a24', '#fcee21'],
]

function cover(title: string, artist: string, i: number) {
  const [a, b] = PALETTES[i % PALETTES.length]
  const shape = i % 3
  const deco =
    shape === 0
      ? `<circle cx="210" cy="90" r="120" fill="${b}" opacity=".55"/><circle cx="60" cy="250" r="70" fill="#fff" opacity=".12"/>`
      : shape === 1
        ? `<rect x="-40" y="130" width="400" height="60" transform="rotate(-24 150 150)" fill="${b}" opacity=".7"/><rect x="-40" y="210" width="400" height="18" transform="rotate(-24 150 150)" fill="#fff" opacity=".18"/>`
        : `<path d="M0 300 L150 60 L300 300Z" fill="${b}" opacity=".6"/><circle cx="150" cy="120" r="30" fill="#fff" opacity=".2"/>`
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/>${deco}<text x="20" y="262" font-family="Segoe UI,Helvetica,Arial" font-size="26" font-weight="300" fill="#fff">${esc(title.toLowerCase())}</text><text x="20" y="284" font-family="Segoe UI,Helvetica,Arial" font-size="13" fill="#fff" opacity=".75">${esc(artist.toUpperCase())}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const CATALOG: { artist: string; albums: { title: string; year: string; songs: string[] }[] }[] = [
  { artist: 'Neon Harbor', albums: [
    { title: 'Lowlight Radio', year: '2007', songs: ['Signal Fires', 'Paper Satellites', 'Lowlight Radio', 'Cold Open', 'Northbound', 'Glass Houses', 'Afterglow'] },
    { title: 'Tidal', year: '2009', songs: ['Undertow', 'Salt & Static', 'Harbor Lights', 'Long Exposure', 'Weightless'] },
  ] },
  { artist: 'Velvet Static', albums: [
    { title: 'Magnetic Summer', year: '2006', songs: ['Polaroid', 'Cassette Heart', 'Magnetic Summer', 'Ferris Wheel', 'Roller Rink', 'Sunburn'] },
  ] },
  { artist: 'Cobalt Youth', albums: [
    { title: 'Brighter Than Blue', year: '2008', songs: ['Arcade Kids', 'Brighter Than Blue', 'Headlights', 'Parking Lot Poets', 'Static Dreams', 'Overpass', 'Home Again', 'Encore'] },
    { title: 'Suburban Myth', year: '2010', songs: ['Cul-de-sac', 'Sprinklers', 'Mall Rats', 'Sodium Glow'] },
  ] },
  { artist: 'Marisol Vega', albums: [
    { title: 'Quiet Architecture', year: '2008', songs: ['Blueprint', 'Stairwell', 'Open Plan', 'Skylight', 'Foundations'] },
  ] },
  { artist: 'The Paper Orchestra', albums: [
    { title: 'Origami', year: '2007', songs: ['Fold One', 'Crane', 'Paper Boats', 'Crease', 'Unfold'] },
  ] },
  { artist: 'Kilowatt Kids', albums: [
    { title: 'Power Surge', year: '2006', songs: ['Voltage', 'Brownout', 'Power Surge', 'Circuit Breaker', 'Live Wire', 'Grounded'] },
  ] },
  { artist: 'Juniper Fox', albums: [
    { title: 'Woodland Hymns', year: '2009', songs: ['Pine Needle', 'Morning Frost', 'Hollow Log', 'Deer Crossing', 'Campfire Choir'] },
  ] },
  { artist: 'Orbit Social Club', albums: [
    { title: 'Zero Gravity Disco', year: '2008', songs: ['Liftoff', 'Moonwalk (Literal)', 'Space Station Slow Dance', 'Re-entry'] },
  ] },
]

export interface DemoIndex {
  byUri: Map<string, Item>
  /** Context URI → ordered tracks. */
  contexts: Map<string, Item[]>
}

export function createDemoLibrary(): Library & { index: DemoIndex } {
  const artists: Item[] = []
  const albums: Item[] = []
  const songs: Item[] = []
  const byUri = new Map<string, Item>()
  const contexts = new Map<string, Item[]>()
  const artistAlbums = new Map<string, Item[]>()
  let n = 0

  CATALOG.forEach((entry, ai) => {
    const artistId = `artist${ai}`
    const artist: Item = { id: artistId, kind: 'artist', title: entry.artist, uri: `demo:artist:${ai}` }
    artists.push(artist)
    artistAlbums.set(artistId, [])
    entry.albums.forEach((al, bi) => {
      const art = cover(al.title, entry.artist, n++)
      const albumId = `album${ai}_${bi}`
      const album: Item = {
        id: albumId, kind: 'album', title: al.title, subtitle: entry.artist, uri: `demo:album:${ai}:${bi}`,
        image: art, imageLarge: art, artistId, artistName: entry.artist, year: al.year, count: al.songs.length,
      }
      if (!artist.image) { artist.image = art; artist.imageLarge = art }
      albums.push(album)
      artistAlbums.get(artistId)!.push(album)
      const tracks = al.songs.map((s, si): Item => ({
        id: `${albumId}_${si}`, kind: 'track', title: s, subtitle: entry.artist, uri: `demo:track:${ai}:${bi}:${si}`,
        image: art, imageLarge: art, artistId, artistName: entry.artist, albumId, albumName: al.title,
        trackNumber: si + 1, durationMs: (150 + ((ai * 37 + bi * 53 + si * 29) % 150)) * 1000,
      }))
      tracks.forEach((t) => { songs.push(t); byUri.set(t.uri, t) })
      contexts.set(album.uri, tracks)
      byUri.set(album.uri, album)
    })
  })

  const pick = (titles: string[]) => titles.map((t) => songs.find((s) => s.title === t)!).filter(Boolean)
  const playlists: Item[] = [
    { name: 'late night drive', songs: ['Northbound', 'Headlights', 'Sodium Glow', 'Harbor Lights', 'Overpass', 'Long Exposure'] },
    { name: 'workout', songs: ['Voltage', 'Power Surge', 'Arcade Kids', 'Live Wire', 'Liftoff', 'Roller Rink'] },
    { name: 'sunday morning', songs: ['Morning Frost', 'Skylight', 'Paper Boats', 'Blueprint', 'Pine Needle'] },
  ].map((p, i) => {
    const tracks = pick(p.songs)
    const art = cover(p.name, 'playlist', i + 5)
    const item: Item = {
      id: `pl${i}`, kind: 'playlist', title: p.name, subtitle: 'you', uri: `demo:playlist:${i}`,
      image: art, imageLarge: art, count: tracks.length,
    }
    contexts.set(item.uri, tracks)
    return item
  })

  const shows: Item[] = [
    { id: 'show0', kind: 'show', title: 'Retro Gadget Hour', subtitle: 'Demo Media', uri: 'demo:show:0' },
  ]
  shows[0].image = shows[0].imageLarge = cover('gadget hour', 'podcast', 10)
  const episodes: Item[] = ['The Squircle Revolution', 'Wireless Sync, Explained', 'Why Brown Was Bold'].map((t, i) => ({
    id: `ep${i}`, kind: 'episode', title: t, subtitle: `episode ${3 - i}`, uri: `demo:episode:${i}`,
    image: shows[0].image, imageLarge: shows[0].image, durationMs: (1800 + i * 420) * 1000,
    artistName: 'Retro Gadget Hour', albumName: 'Retro Gadget Hour',
  }))
  episodes.forEach((e) => byUri.set(e.uri, e))
  contexts.set(shows[0].uri, episodes)

  const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 180))
  const history = [songs[3], songs[12], songs[20], songs[7], songs[31], songs[15]].filter(Boolean)

  return {
    kind: 'demo',
    index: { byUri, contexts },
    artists: () => delay([...artists].sort(byTitle)),
    albums: () => delay([...albums].sort(byTitle)),
    songs: () => delay([...songs].sort(byTitle)),
    playlists: () => delay(playlists),
    podcasts: () => delay(shows),
    history: () => delay(history),
    artistAlbums: (a) => delay(artistAlbums.get(a.id) ?? []),
    albumTracks: (a) => delay(contexts.get(a.uri) ?? []),
    playlistTracks: (p) => delay(contexts.get(p.uri) ?? []),
    showEpisodes: (s) => delay(contexts.get(s.uri) ?? []),
    search: (q) => {
      const m = (i: Item) => i.title.toLowerCase().includes(q.toLowerCase()) || !!i.subtitle?.toLowerCase().includes(q.toLowerCase())
      return delay({
        songs: songs.filter(m).slice(0, 10), albums: albums.filter(m).slice(0, 10),
        artists: artists.filter(m).slice(0, 10), playlists: playlists.filter(m),
      })
    },
    profile: () => delay({ name: 'guest', product: 'demo' }),
  }
}
