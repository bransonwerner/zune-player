import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Library } from '../library/types'
import type { Playback } from '../playback/types'

export type DeviceModel = 'zune30' | 'zune80' | 'zunehd'

export const MODELS: { id: DeviceModel; name: string; colors: { id: string; name: string }[] }[] = [
  { id: 'zune30', name: 'zune 30', colors: [
    { id: 'brown', name: 'brown' }, { id: 'black', name: 'black' }, { id: 'white', name: 'white' }] },
  { id: 'zune80', name: 'zune 80', colors: [
    { id: 'black', name: 'black' }, { id: 'red', name: 'red' }, { id: 'pink', name: 'pink' },
    { id: 'green', name: 'green' }] },
  { id: 'zunehd', name: 'zune hd', colors: [
    { id: 'black', name: 'black' }, { id: 'platinum', name: 'platinum' }, { id: 'blue', name: 'blue' },
    { id: 'red', name: 'red' }, { id: 'magenta', name: 'magenta' }] },
]

export interface Services {
  library: Library
  playback: Playback
  signedIn: boolean
  hasClientId: boolean
  signIn(): void
  signOut(): void
  model: DeviceModel
  setModel(m: DeviceModel): void
}

export const ServicesContext = createContext<Services | null>(null)

export function useServices() {
  const s = useContext(ServicesContext)
  if (!s) throw new Error('ServicesContext missing')
  return s
}

export interface AsyncState<T> {
  data?: T
  error?: string
  loading: boolean
}

/** Runs `fn` whenever `key` changes; ignores stale responses. */
export function useAsync<T>(key: string | null, fn: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: !!key })
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    if (!key) return
    let live = true
    setState({ loading: true })
    fnRef.current().then(
      (data) => live && setState({ data, loading: false }),
      (e: Error) => live && setState({ error: e.message || 'something went wrong', loading: false }),
    )
    return () => { live = false }
  }, [key])
  return state
}

export function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '')
}
