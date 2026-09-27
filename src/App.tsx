import { useEffect, useMemo, useState } from 'react'
import { DEVICE_SIZE, Zune30, Zune80, ZuneHD } from './devices/Devices'
import { createDemoLibrary } from './library/demoLibrary'
import { createSpotifyLibrary } from './library/spotifyLibrary'
import { input, type Action } from './lib/input'
import { MODELS, ServicesContext, useAsync, useServices, type DeviceModel, type Services } from './lib/services'
import { ClassicOS } from './os/classic/ClassicOS'
import { HdOS } from './os/hd/HdOS'
import { createDemoPlayback } from './playback/demoPlayback'
import { createSpotifyPlayback } from './playback/spotifyPlayback'
import type { Playback } from './playback/types'
import type { Library } from './library/types'
import {
  getClientId, handleRedirect, isSignedIn, login, logout, onAuthChange, redirectUri, setClientId,
} from './spotify/auth'

const KEYS: Record<string, Action> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'select', Backspace: 'back', Escape: 'back', ' ': 'playpause', Home: 'home', h: 'home',
  '+': 'volup', '=': 'volup', '-': 'voldown', _: 'voldown', m: 'media',
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignore */ }
}

function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return vp
}

export default function App() {
  const [model, setModelState] = useState<DeviceModel>(() => load('zune.model', 'zune80'))
  const [colors, setColors] = useState<Record<DeviceModel, string>>(() =>
    load('zune.colors', { zune30: 'brown', zune80: 'black', zunehd: 'black' }))
  const [signedIn, setSignedIn] = useState(isSignedIn)
  const [clientId, setClientIdState] = useState(getClientId)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    handleRedirect().then((err) => { if (err) setAuthError(err) })
    return onAuthChange(() => { setSignedIn(isSignedIn()); setClientIdState(getClientId()) })
  }, [])

  const { library, playback } = useMemo((): { library: Library; playback: Playback } => {
    if (signedIn) return { library: createSpotifyLibrary(), playback: createSpotifyPlayback() }
    const demo = createDemoLibrary()
    return { library: demo, playback: createDemoPlayback(demo.index) }
  }, [signedIn])
  useEffect(() => () => playback.destroy(), [playback])

  const setModel = (m: DeviceModel) => { setModelState(m); save('zune.model', m) }
  const setColor = (c: string) => {
    const next = { ...colors, [model]: c }
    setColors(next)
    save('zune.colors', next)
  }

  const services: Services = {
    library, playback, signedIn, model, setModel,
    hasClientId: !!clientId,
    signIn: () => { login().catch((e: Error) => setAuthError(e.message)) },
    signOut: logout,
  }

  // Keyboard → device buttons.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return
      const a = KEYS[e.key]
      if (!a || e.metaKey || e.ctrlKey || e.altKey) return
      e.preventDefault()
      playback.activate()
      input.emit(a)
    }
    const onFirstPointer = () => playback.activate()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onFirstPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onFirstPointer)
    }
  }, [playback])

  const vp = useViewport()
  const wide = vp.w >= 920
  const size = DEVICE_SIZE[model]
  const availW = wide ? vp.w - 380 : vp.w - 24
  const availH = wide ? vp.h - 56 : Math.min(vp.h - 40, 900)
  const scale = Math.min(availW / size.w, availH / size.h, 1.5)

  const color = colors[model]
  const screen = model === 'zunehd' ? <HdOS /> : <ClassicOS />
  const device =
    model === 'zune30' ? <Zune30 color={color}>{screen}</Zune30>
      : model === 'zune80' ? <Zune80 color={color}>{screen}</Zune80>
        : <ZuneHD color={color}>{screen}</ZuneHD>

  return (
    <ServicesContext.Provider value={services}>
      <div className={`app ${wide ? 'wide' : 'narrow'}`}>
        <Panel
          model={model} setModel={setModel} color={color} setColor={setColor}
          clientId={clientId} signedIn={signedIn} authError={authError}
          onDismissError={() => setAuthError(null)}
        />
        <main className="stage">
          <div className="stage-glow" />
          <div className="device-box" style={{ width: size.w * scale, height: size.h * scale }}>
            <div className="device-scale" key={model} style={{ transform: `scale(${scale})` }}>
              {device}
            </div>
          </div>
        </main>
      </div>
    </ServicesContext.Provider>
  )
}

function Panel(props: {
  model: DeviceModel; setModel(m: DeviceModel): void; color: string; setColor(c: string): void
  clientId: string; signedIn: boolean; authError: string | null; onDismissError(): void
}) {
  const { model, setModel, color, setColor, clientId, signedIn, authError } = props
  const [draft, setDraft] = useState(clientId)
  const [editing, setEditing] = useState(!clientId)
  const current = MODELS.find((m) => m.id === model)!

  return (
    <aside className="panel">
      <div className="brand">
        <span className="brand-mark" />
        <span>zune</span><span className="brand-sub">player</span>
      </div>

      <section>
        <h2>device</h2>
        <div className="pivot">
          {MODELS.map((m) => (
            <button key={m.id} className={m.id === model ? 'sel' : ''} onClick={() => setModel(m.id)}>{m.name}</button>
          ))}
        </div>
        <div className="swatches">
          {current.colors.map((c) => (
            <button
              key={c.id}
              className={`swatch sw-${model}-${c.id} ${c.id === color ? 'sel' : ''}`}
              title={c.name}
              aria-label={c.name}
              onClick={() => setColor(c.id)}
            />
          ))}
          <span className="swatch-name">{color}</span>
        </div>
      </section>

      <section>
        <h2>spotify</h2>
        {authError && (
          <div className="alert" onClick={props.onDismissError}>{authError} <span>dismiss</span></div>
        )}
        {signedIn ? (
          <SignedIn />
        ) : editing ? (
          <div className="setup">
            <p>you're in <b>demo mode</b>. to stream your own music, connect a free spotify developer app (playback needs premium):</p>
            <ol>
              <li>open <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">developer.spotify.com/dashboard</a> and <b>create app</b></li>
              <li>add redirect uri <code>{redirectUri()}</code></li>
              <li>tick <b>Web API</b> and <b>Web Playback SDK</b>, then save</li>
              <li>under <b>user management</b>, add your spotify email</li>
              <li>paste the app's <b>client id</b> here</li>
            </ol>
            <div className="field">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="client id" spellCheck={false} />
              <button
                disabled={!/^[0-9a-f]{32}$/i.test(draft.trim())}
                onClick={() => { setClientId(draft); setEditing(false) }}
              >save</button>
            </div>
          </div>
        ) : (
          <div className="setup">
            <p>client id saved. sign in to load your library.</p>
            <button className="cta" onClick={() => login().catch(() => {})}>sign in with spotify</button>
            <button className="link" onClick={() => setEditing(true)}>change client id</button>
          </div>
        )}
      </section>

      <section className="keys">
        <h2>controls</h2>
        <dl>
          <dt>↑ ↓ ← →</dt><dd>zune pad / d-pad</dd>
          <dt>enter</dt><dd>select</dd>
          <dt>esc</dt><dd>back (hold the back button for home)</dd>
          <dt>space</dt><dd>play / pause</dd>
          <dt>+ −</dt><dd>volume</dd>
          <dt>m</dt><dd>zune hd media button</dd>
        </dl>
        <p className="fine">
          {model === 'zune80' && 'drag on the zune pad to scroll; click its edges to move.'}
          {model === 'zune30' && 'click and hold the d-pad edges to scroll.'}
          {model === 'zunehd' && 'tap and swipe the screen. the top-left edge button is media, top-right is power; the button under the screen is back.'}
        </p>
      </section>

      <p className="fine disclaimer">fan-made tribute. not affiliated with microsoft or spotify.</p>
    </aside>
  )
}

function SignedIn() {
  const { library } = useServices()
  const profile = useAsync(`${library.kind}:profile`, () => library.profile())
  return (
    <div className="setup">
      <p>
        connected{profile.data ? <> as <b>{profile.data.name}</b></> : ''}
        {profile.data?.product && profile.data.product !== 'premium' && (
          <span className="warn"> — playback needs spotify premium</span>
        )}
      </p>
      <button className="link" onClick={logout}>sign out</button>
    </div>
  )
}
