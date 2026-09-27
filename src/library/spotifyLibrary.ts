import { ApiError, pageAll, sp } from '../spotify/api'
import { byTitle, type Item, type Library, type Profile, type SearchResults } from './types'

/* Minimal shapes of the Spotify objects we read. */
interface SImage { url: string; width: number | null }
interface SArtist { id: string; name: string; uri: string; images?: SImage[] }
interface SAlbum {
  id: string; name: string; uri: string; images?: SImage[]; artists: SArtist[]
  release_date?: string; total_tracks?: number
}
interface STrack {
  id: string; name: string; uri: string; duration_ms: number; track_number?: number
  artists: SArtist[]; album?: SAlbum; type?: string; is_local?: boolean
}
interface SPlaylist {
  id: string; name: string; uri: string; images?: SImage[] | null
  owner?: { display_name?: string }; tracks?: { total: number }; items?: { total: number }
}
interface SShow { id: string; name: string; uri: string; images?: SImage[]; publisher?: string }
interface SEpisode {
  id: string; name: string; uri: string; images?: SImage[]; duration_ms: number; release_date?: string
}

function pickImage(images: SImage[] | null | undefined, target: number) {
  if (!images?.length) return undefined
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
  return (sorted.find((i) => (i.width ?? 0) >= target) ?? sorted[sorted.length - 1]).url
}

const artistItem = (a: SArtist): Item => ({
  id: a.id, kind: 'artist', title: a.name, uri: a.uri,
  image: pickImage(a.images, 160), imageLarge: pickImage(a.images, 600),
})

const albumItem = (a: SAlbum): Item => ({
  id: a.id, kind: 'album', title: a.name, uri: a.uri,
  subtitle: a.artists?.map((x) => x.name).join(', '),
  artistId: a.artists?.[0]?.id, artistName: a.artists?.[0]?.name,
  image: pickImage(a.images, 160), imageLarge: pickImage(a.images, 600),
  year: a.release_date?.slice(0, 4), count: a.total_tracks,
})

const trackItem = (t: STrack, album?: Item): Item => ({
  id: t.id ?? t.uri, kind: t.type === 'episode' ? 'episode' : 'track', title: t.name, uri: t.uri,
  subtitle: t.artists?.map((x) => x.name).join(', '),
  artistId: t.artists?.[0]?.id, artistName: t.artists?.[0]?.name,
  albumId: t.album?.id ?? album?.id, albumName: t.album?.name ?? album?.title,
  image: t.album ? pickImage(t.album.images, 160) : album?.image,
  imageLarge: t.album ? pickImage(t.album.images, 600) : album?.imageLarge,
  durationMs: t.duration_ms, trackNumber: t.track_number,
})

const playlistItem = (p: SPlaylist): Item => ({
  id: p.id, kind: 'playlist', title: p.name, uri: p.uri,
  subtitle: p.owner?.display_name,
  image: pickImage(p.images, 160), imageLarge: pickImage(p.images, 600),
  count: p.items?.total ?? p.tracks?.total,
})

/** Development-mode apps may reject large page sizes; retry smaller. */
async function pageFlexible<T>(path: string, cap: number): Promise<T[]> {
  try {
    return await pageAll<T>(path, cap)
  } catch (e) {
    if (e instanceof ApiError && e.status === 400 && /limit=50/.test(path)) {
      return pageAll<T>(path.replace('limit=50', 'limit=10'), cap)
    }
    throw e
  }
}

export function createSpotifyLibrary(): Library {
  const cache = new Map<string, Promise<unknown>>()
  function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (!cache.has(key)) {
      const p = fn()
      p.catch(() => cache.delete(key))
      cache.set(key, p)
    }
    return cache.get(key) as Promise<T>
  }

  const savedAlbums = () =>
    memo('savedAlbums', async () =>
      (await pageFlexible<{ album: SAlbum }>('/me/albums?limit=50', 300)).map((x) => albumItem(x.album)))

  const savedTracks = () =>
    memo('savedTracks', async () =>
      (await pageFlexible<{ track: STrack }>('/me/tracks?limit=50', 500))
        .filter((x) => x.track && !x.track.is_local)
        .map((x) => trackItem(x.track)))

  return {
    kind: 'spotify',

    // Zune's "artists" = the artists in your collection: followed artists plus
    // anyone with a saved album.
    artists: () =>
      memo('artists', async () => {
        const map = new Map<string, Item>()
        try {
          let url: string | null = '/me/following?type=artist&limit=50'
          while (url && map.size < 500) {
            const page: { artists: { items: SArtist[]; next: string | null } } = await sp(url)
            page.artists.items.forEach((a) => map.set(a.id, artistItem(a)))
            url = page.artists.next
          }
        } catch {
          /* following may be unavailable; fall back to album artists */
        }
        for (const al of await savedAlbums()) {
          if (al.artistId && !map.has(al.artistId))
            map.set(al.artistId, {
              id: al.artistId, kind: 'artist', title: al.artistName ?? '',
              uri: `spotify:artist:${al.artistId}`,
            })
        }
        return [...map.values()].sort(byTitle)
      }),

    albums: async () => [...(await savedAlbums())].sort(byTitle),
    songs: async () => [...(await savedTracks())].sort(byTitle),

    playlists: () =>
      memo('playlists', async () =>
        (await pageFlexible<SPlaylist>('/me/playlists?limit=50', 300)).map(playlistItem)),

    podcasts: () =>
      memo('podcasts', async () =>
        (await pageFlexible<{ show: SShow }>('/me/shows?limit=50', 200)).map(({ show }) => ({
          id: show.id, kind: 'show' as const, title: show.name, uri: show.uri, subtitle: show.publisher,
          image: pickImage(show.images, 160), imageLarge: pickImage(show.images, 600),
        })).sort(byTitle)),

    history: async () => {
      const res = await sp<{ items: { track: STrack }[] }>('/me/player/recently-played?limit=50')
      const seen = new Set<string>()
      return res.items
        .map((x) => trackItem(x.track))
        .filter((t) => (seen.has(t.uri) ? false : (seen.add(t.uri), true)))
    },

    artistAlbums: (artist) =>
      memo(`artist:${artist.id}`, async () => {
        const all = await pageFlexible<SAlbum>(
          `/artists/${artist.id}/albums?include_groups=album,single&limit=50`, 100)
        // Collapse duplicate editions by name.
        const seen = new Set<string>()
        return all.map(albumItem).filter((a) => {
          const k = a.title.toLowerCase()
          return seen.has(k) ? false : (seen.add(k), true)
        })
      }),

    albumTracks: (album) =>
      memo(`album:${album.id}`, async () => {
        let full = album
        if (!album.image) {
          try { full = albumItem(await sp<SAlbum>(`/albums/${album.id}`)) } catch { /* keep partial */ }
        }
        const tracks = await pageFlexible<STrack>(`/albums/${album.id}/tracks?limit=50`, 200)
        return tracks.map((t) => trackItem(t, full))
      }),

    playlistTracks: (pl) =>
      memo(`playlist:${pl.id}`, async () => {
        type Entry = { track?: STrack | null; item?: STrack | null }
        let entries: Entry[]
        try {
          entries = await pageFlexible<Entry>(`/playlists/${pl.id}/items?limit=50`, 500)
        } catch {
          entries = await pageFlexible<Entry>(`/playlists/${pl.id}/tracks?limit=50`, 500)
        }
        return entries
          .map((e) => e.item ?? e.track)
          .filter((t): t is STrack => !!t && !t.is_local && !!t.uri)
          .map((t) => trackItem(t))
      }),

    showEpisodes: (show) =>
      memo(`show:${show.id}`, async () =>
        (await pageFlexible<SEpisode>(`/shows/${show.id}/episodes?limit=50`, 100)).filter(Boolean).map((e) => ({
          id: e.id, kind: 'episode' as const, title: e.name, uri: e.uri, subtitle: e.release_date,
          image: pickImage(e.images, 160) ?? show.image, imageLarge: pickImage(e.images, 600) ?? show.imageLarge,
          durationMs: e.duration_ms,
        }))),

    search: async (q): Promise<SearchResults> => {
      const params = new URLSearchParams({ q, type: 'track,album,artist,playlist', limit: '10' })
      const res = await sp<{
        tracks?: { items: STrack[] }; albums?: { items: SAlbum[] }
        artists?: { items: SArtist[] }; playlists?: { items: (SPlaylist | null)[] }
      }>(`/search?${params}`)
      return {
        songs: res.tracks?.items.filter(Boolean).map((t) => trackItem(t)) ?? [],
        albums: res.albums?.items.filter(Boolean).map(albumItem) ?? [],
        artists: res.artists?.items.filter(Boolean).map(artistItem) ?? [],
        playlists: res.playlists?.items.filter((p): p is SPlaylist => !!p).map(playlistItem) ?? [],
      }
    },

    profile: () =>
      memo('profile', async () => {
        const me = await sp<{ display_name?: string; id: string; images?: SImage[]; product?: string }>('/me')
        return { name: me.display_name || me.id, image: pickImage(me.images, 160), product: me.product } as Profile
      }),
  }
}
