// Spotify Authorization Code flow with PKCE — no backend or client secret needed.

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-library-read',
  'user-follow-read',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ')

const KEY_CLIENT = 'zune.clientId'
const KEY_TOKEN = 'zune.token'
const KEY_VERIFIER = 'zune.pkce.verifier'
const KEY_STATE = 'zune.pkce.state'

interface StoredToken {
  access_token: string
  refresh_token?: string
  expires_at: number
}

type Listener = () => void
const listeners = new Set<Listener>()
export function onAuthChange(fn: Listener) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
const notify = () => listeners.forEach((l) => l())

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

export function getClientId(): string {
  return read<string>(KEY_CLIENT) || import.meta.env.VITE_SPOTIFY_CLIENT_ID || ''
}
export function setClientId(id: string) {
  write(KEY_CLIENT, id.trim() || null)
  notify()
}

export function redirectUri() {
  return `${location.origin}${import.meta.env.BASE_URL}`
}

export function isSignedIn() {
  return !!read<StoredToken>(KEY_TOKEN)
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function randomString(len: number) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(values, (v) => chars[v % chars.length]).join('')
}

export async function login() {
  const clientId = getClientId()
  if (!clientId) throw new Error('Add your Spotify Client ID first.')
  const verifier = randomString(64)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const state = randomString(16)
  write(KEY_VERIFIER, verifier)
  write(KEY_STATE, state)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: b64url(new Uint8Array(digest)),
    redirect_uri: redirectUri(),
    state,
  })
  location.assign(`https://accounts.spotify.com/authorize?${params}`)
}

export function logout() {
  write(KEY_TOKEN, null)
  notify()
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error_description || json.error || `Token request failed (${res.status})`)
  const prev = read<StoredToken>(KEY_TOKEN)
  const token: StoredToken = {
    access_token: json.access_token,
    // Refresh responses may omit refresh_token; keep the old one.
    refresh_token: json.refresh_token ?? prev?.refresh_token,
    expires_at: Date.now() + (json.expires_in ?? 3600) * 1000,
  }
  write(KEY_TOKEN, token)
  return token
}

/** Call once on page load. Completes a login redirect if one is in the URL. */
export async function handleRedirect(): Promise<string | null> {
  const url = new URL(location.href)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  if (!code && !error) return null
  const clean = () => history.replaceState(null, '', url.pathname)
  if (error) {
    clean()
    return error === 'access_denied' ? 'Spotify sign-in was cancelled.' : `Spotify sign-in failed: ${error}`
  }
  const verifier = read<string>(KEY_VERIFIER)
  const state = read<string>(KEY_STATE)
  clean()
  if (!verifier || state !== url.searchParams.get('state')) return 'Sign-in state mismatch — try again.'
  try {
    await tokenRequest({
      grant_type: 'authorization_code',
      code: code!,
      redirect_uri: redirectUri(),
      client_id: getClientId(),
      code_verifier: verifier,
    })
    write(KEY_VERIFIER, null)
    write(KEY_STATE, null)
    notify()
    return null
  } catch (e) {
    return (e as Error).message
  }
}

let refreshing: Promise<StoredToken> | null = null

export async function getAccessToken(force = false): Promise<string> {
  const token = read<StoredToken>(KEY_TOKEN)
  if (!token) throw new Error('Not signed in')
  if (!force && token.expires_at - Date.now() > 60_000) return token.access_token
  if (!token.refresh_token) {
    logout()
    throw new Error('Session expired')
  }
  refreshing ??= tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: token.refresh_token,
    client_id: getClientId(),
  }).finally(() => (refreshing = null))
  try {
    return (await refreshing).access_token
  } catch (e) {
    logout()
    throw e
  }
}
