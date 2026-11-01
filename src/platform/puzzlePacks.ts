import type { PackManifest, PackPuzzle } from '../core/puzzles/packs'

const BASE = `${import.meta.env.BASE_URL}puzzles/`
const packCache = new Map<string, Promise<PackPuzzle[]>>()
let manifest: Promise<PackManifest> | null = null

/** Static JSON packs; the service worker caches them for offline play. */
export function loadManifest(): Promise<PackManifest> {
  manifest ??= fetchJson<PackManifest>(`${BASE}index.json`).catch((e) => {
    manifest = null
    throw e
  })
  return manifest
}

export function loadPack(file: string): Promise<PackPuzzle[]> {
  let p = packCache.get(file)
  if (!p) {
    p = fetchJson<PackPuzzle[]>(`${BASE}${file}`).catch((e) => {
      packCache.delete(file)
      throw e
    })
    packCache.set(file, p)
  }
  return p
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return (await res.json()) as T
}
