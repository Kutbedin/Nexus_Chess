// Offline support. Puzzle packs and the engine are precached on install; hashed build assets
// (JS, CSS, lazy locale chunks) are cached on first use; navigations fall back to the cached shell.
const CACHE = 'gambitzone-v1'
const SCOPE = new URL(self.registration.scope).pathname
const ENGINE = ['engine/stockfish-19-lite-single.js', 'engine/stockfish-19-lite-single.wasm', 'engine/Copying.txt']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      const res = await fetch(`${SCOPE}puzzles/index.json`, { cache: 'no-cache' })
      const manifest = await res.clone().json()
      await cache.put(`${SCOPE}puzzles/index.json`, res)
      await cache.addAll([SCOPE, ...ENGINE.map((f) => SCOPE + f), ...manifest.packs.map((p) => `${SCOPE}puzzles/${p.file}`)])
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          void caches.open(CACHE).then((c) => c.put(SCOPE, copy))
          return res
        })
        .catch(() => caches.match(SCOPE)),
    )
    return
  }

  const path = url.pathname.slice(SCOPE.length)
  if (path.startsWith('assets/') || path.startsWith('engine/') || path.startsWith('puzzles/pack-')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              void caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  if (path === 'puzzles/index.json') {
    event.respondWith(fetch(req).catch(() => caches.match(req)))
  }
})
