# Local dev: seeing the old product name after a rebrand

After pulling a rebrand (for example **Nexus Chess** → **GambitZone** on `main`), the browser tab or in-app heading can still show the old name even though the repo is up to date. That is almost always **stale local assets**, not missing source changes.

## Update your checkout

```bash
git pull origin main
```

Confirm branding in the tree (should find no user-facing “Nexus” strings):

```bash
rg -i 'nexus|nexuschess' index.html public src/i18n
```

Expected on current `main`: `index.html` title **GambitZone**, service worker cache name **`gambitzone-v1`**, i18n `app.title` **GambitZone** in all locales. Legacy `nexus.*` keys in `src/storageKeys.ts` are for one-time localStorage migration only (not shown in the UI).

## Restart the dev server

Stop Vite (`Ctrl+C`), then start again:

```bash
npm run dev
```

Vite does not always pick up every static change while it is already running.

## Hard refresh and clear site data

1. **Hard reload:** `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (macOS).
2. If the tab title is still wrong, clear data for **`http://localhost:5173`** (port may differ):
   - **Chrome / Edge:** DevTools → Application → Storage → “Clear site data”, or Application → Service Workers → **Unregister**, then Application → Cache Storage → delete old caches (e.g. `nexus-v2`).
   - **Firefox:** Settings → Privacy → Cookies and Site Data → Manage Data, or DevTools → Storage → clear caches / unregister service worker.

Production builds register a service worker (`public/sw.js`). An old worker can keep serving cached `index.html` with the previous `<title>` until a new worker installs and the old caches are deleted. Unregistering the worker and clearing site data forces a clean load.

## Still stuck?

- Use a private/incognito window (no old SW or cache).
- Delete `node_modules/.vite` and run `npm run dev` again if HMR behaves oddly.
