import { getAccessToken } from './auth'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const BASE = 'https://api.spotify.com/v1'
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function sp<T = unknown>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(path.startsWith('http') ? path : BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (res.status === 401 && attempt === 0) {
    await getAccessToken(true)
    return sp<T>(path, init, attempt + 1)
  }
  if (res.status === 429 && attempt < 3) {
    const retry = Number(res.headers.get('Retry-After') || '1')
    await wait(Math.min(retry, 10) * 1000)
    return sp<T>(path, init, attempt + 1)
  }
  if (res.status === 204 || res.status === 202) return undefined as T
  const text = await res.text()
  let json: unknown = undefined
  try {
    json = text ? JSON.parse(text) : undefined
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message || res.statusText || 'Request failed'
    throw new ApiError(res.status, msg)
  }
  return json as T
}

interface Paging<T> {
  items: T[]
  next: string | null
}

/** Follow `next` links until `cap` items are collected. */
export async function pageAll<T>(path: string, cap = 500): Promise<T[]> {
  const out: T[] = []
  let url: string | null = path
  while (url && out.length < cap) {
    const page: Paging<T> = await sp<Paging<T>>(url)
    out.push(...page.items.filter(Boolean))
    url = page.next
  }
  return out.slice(0, cap)
}
