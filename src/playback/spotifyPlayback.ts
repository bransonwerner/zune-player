import { getAccessToken } from '../spotify/auth'
import { ApiError, sp } from '../spotify/api'
import { createStore, initialState, type Playback, type Repeat, type Track } from './types'

const VOLUME_KEY = 'zune.volume'

let sdkPromise: Promise<void> | null = null
function loadSdk() {
  sdkPromise ??= new Promise<void>((resolve, reject) => {
    if (window.Spotify) return resolve()
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const s = document.createElement('script')
    s.src = 'https://sdk.scdn.co/spotify-player.js'
    s.async = true
    s.onerror = () => { sdkPromise = null; reject(new Error('Could not load the Spotify player.')) }
    document.head.appendChild(s)
  })
  return sdkPromise
}

function toTrack(t: Spotify.Track): Track {
  const imgs = [...(t.album?.images ?? [])].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))
  return {
    uri: t.uri,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(', '),
    album: t.album?.name ?? '',
    image: (imgs.find((i) => (i.width ?? 0) >= 160) ?? imgs[imgs.length - 1])?.url,
    imageLarge: imgs[imgs.length - 1]?.url,
    durationMs: t.duration_ms,
  }
}

const REPEAT: Repeat[] = ['off', 'context', 'track']

export function createSpotifyPlayback(): Playback {
  const savedVol = Number(localStorage.getItem(VOLUME_KEY) ?? '0.6')
  const store = createStore({ ...initialState, status: 'connecting', volume: isNaN(savedVol) ? 0.6 : savedVol })
  let player: Spotify.Player | null = null
  let deviceId: string | null = null
  let destroyed = false
  let activated = false

  const fail = (message: string) => store.set({ message })

  loadSdk()
    .then(() => {
      if (destroyed) return
      player = new window.Spotify.Player({
        name: 'Zune',
        getOAuthToken: (cb) => { getAccessToken().then(cb).catch(() => fail('Session expired — sign in again.')) },
        volume: store.get().volume,
      })
      player.addListener('ready', ({ device_id }) => {
        deviceId = device_id
        store.set({ status: 'ready', message: undefined })
      })
      player.addListener('not_ready', () => store.set({ status: 'connecting' }))
      player.addListener('initialization_error', ({ message }) =>
        store.set({ status: 'error', message: `This browser can't play Spotify (${message}). Try desktop Chrome, Edge or Firefox.` }))
      player.addListener('authentication_error', () =>
        store.set({ status: 'error', message: 'Spotify rejected the sign-in. Sign out and back in.' }))
      player.addListener('account_error', () =>
        store.set({ status: 'error', message: 'Spotify Premium is required to play music here.' }))
      player.addListener('playback_error', ({ message }) => fail(message))
      player.addListener('player_state_changed', (s) => {
        if (!s) return
        const cur = s.track_window.current_track
        store.set({
          track: cur ? toTrack(cur) : null,
          paused: s.paused,
          positionMs: s.position,
          stamp: Date.now(),
          shuffle: s.shuffle,
          repeat: REPEAT[s.repeat_mode] ?? 'off',
          next: s.track_window.next_tracks.map(toTrack),
        })
      })
      player.connect()
    })
    .catch((e: Error) => store.set({ status: 'error', message: e.message }))

  const api = (path: string, body?: unknown) =>
    sp(`${path}${path.includes('?') ? '&' : '?'}device_id=${deviceId}`, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    })

  const wrap = (p: Promise<unknown> | undefined) => {
    p?.catch((e: Error) => fail(e instanceof ApiError && e.status === 403 ? 'Spotify Premium is required.' : e.message))
  }

  return {
    getState: store.get,
    subscribe: store.subscribe,
    activate() {
      if (activated || !player) return
      activated = true
      // Required by Safari/iOS-style autoplay policies; harmless elsewhere.
      wrap(player.activateElement?.())
    },
    async play(req) {
      if (!deviceId) {
        fail(store.get().status === 'error' ? store.get().message! : 'Still connecting to Spotify…')
        return
      }
      this.activate()
      const body: Record<string, unknown> = {}
      if (req.contextUri) body.context_uri = req.contextUri
      if (req.uris) body.uris = req.uris
      if (req.offsetUri) body.offset = { uri: req.offsetUri }
      try {
        await api('/me/player/play', body)
      } catch (e) {
        // A freshly registered device can take a moment to be visible to the API.
        if (e instanceof ApiError && e.status === 404) {
          await new Promise((r) => setTimeout(r, 1200))
          try { await api('/me/player/play', body) } catch (e2) { fail((e2 as Error).message) }
        } else fail(e instanceof ApiError && e.status === 403 ? 'Spotify Premium is required.' : (e as Error).message)
      }
    },
    toggle() {
      this.activate()
      if (!store.get().track) return
      wrap(player?.togglePlay())
    },
    next() { wrap(player?.nextTrack()) },
    prev() { wrap(player?.previousTrack()) },
    seek(ms) {
      store.set({ positionMs: ms, stamp: Date.now() })
      wrap(player?.seek(Math.round(ms)))
    },
    setVolume(v) {
      const vol = Math.min(1, Math.max(0, v))
      store.set({ volume: vol })
      localStorage.setItem(VOLUME_KEY, String(vol))
      wrap(player?.setVolume(vol))
    },
    setShuffle(on) {
      store.set({ shuffle: on })
      wrap(api(`/me/player/shuffle?state=${on}`))
    },
    setRepeat(r) {
      store.set({ repeat: r })
      wrap(api(`/me/player/repeat?state=${r}`))
    },
    destroy() {
      destroyed = true
      player?.disconnect()
    },
  }
}
