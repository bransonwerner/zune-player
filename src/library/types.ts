export type Kind = 'artist' | 'album' | 'track' | 'playlist' | 'show' | 'episode'

export interface Item {
  id: string
  kind: Kind
  title: string
  /** Secondary line: artist for songs/albums, owner for playlists, etc. */
  subtitle?: string
  image?: string
  imageLarge?: string
  uri: string
  durationMs?: number
  trackNumber?: number
  year?: string
  /** For albums/tracks: primary artist id so "artist" pages can be reached. */
  artistId?: string
  artistName?: string
  albumId?: string
  albumName?: string
  count?: number
}

export interface PlayRequest {
  /** Album / playlist / show URI to play within. */
  contextUri?: string
  /** Explicit list of track URIs (used when there's no context, e.g. "all songs"). */
  uris?: string[]
  offsetUri?: string
}

export interface SearchResults {
  songs: Item[]
  albums: Item[]
  artists: Item[]
  playlists: Item[]
}

export interface Profile {
  name: string
  image?: string
  product?: string
}

export interface Library {
  readonly kind: 'spotify' | 'demo'
  artists(): Promise<Item[]>
  albums(): Promise<Item[]>
  songs(): Promise<Item[]>
  playlists(): Promise<Item[]>
  podcasts(): Promise<Item[]>
  history(): Promise<Item[]>
  artistAlbums(artist: Item): Promise<Item[]>
  albumTracks(album: Item): Promise<Item[]>
  playlistTracks(playlist: Item): Promise<Item[]>
  showEpisodes(show: Item): Promise<Item[]>
  search(query: string): Promise<SearchResults>
  profile(): Promise<Profile>
}

/** How a track list should be played when an entry is picked. */
export function playRequestFor(list: Item[], picked: Item, contextUri?: string): PlayRequest {
  if (contextUri) return { contextUri, offsetUri: picked.uri }
  const playable = list.filter((i) => i.kind === 'track' || i.kind === 'episode')
  const idx = Math.max(0, playable.findIndex((i) => i.uri === picked.uri))
  // Keep the queue a reasonable size for the API.
  const start = Math.max(0, idx - 50)
  return { uris: playable.slice(start, start + 150).map((i) => i.uri), offsetUri: picked.uri }
}

const sortKey = (s: string) => s.toLowerCase().replace(/^(the|a|an)\s+/, '')
export const byTitle = (a: Item, b: Item) => sortKey(a.title).localeCompare(sortKey(b.title))

export function fmtTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
