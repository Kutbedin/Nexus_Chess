# Nexus Chess

Turkish-first, single-player-first web chess: bots with personalities, a level map with bosses,
puzzles, a post-game coach, and personal "revenge" puzzles built from your own mistakes.

Architecture plan (Turkish): [docs/architecture.md](docs/architecture.md)

## Getting started

```bash
npm install        # also copies the Stockfish WASM build into public/engine/
npm run dev        # http://localhost:5173
npm run check      # lint + typecheck + unit tests
npm run build
```

Requires Node 22+.

## Layout

| Path | What |
| --- | --- |
| `src/core/` | Framework-free game logic: session, bot controller, bots, progression, coach, revenge, puzzles, Phase 1b classroom model |
| `src/platform/` | Browser adapters: Stockfish WASM provider, local storage adapter, PostHog, school mode, puzzle pack loader |
| `public/puzzles/` | ~2,000 validated Lichess CC0 puzzles in rating-sorted packs (generated, do not edit) |
| `public/sw.js` | Service worker for offline play |
| `scripts/build-puzzles.mjs` | Regenerates the puzzle packs from the Lichess dump (`--repack` re-chunks without downloading) |
| `src/i18n/` | i18next setup, locale registry, lazy-loaded locale files (`tr`, `en`, beta: `de`, `fr`, `es`, `ru`, `zh-Hans`) |
| `src/ui/` | React screens and components |
| `supabase/migrations/` | Proposed backend schema (not applied yet) |
| `.cursor/rules/` | Architecture, i18n, licensing, and testing rules |

## Configuration

Optional `.env.local`:

```
VITE_POSTHOG_KEY=phc_...
VITE_POSTHOG_HOST=https://eu.i.posthog.com
```

Without a key, analytics is a no-op and PostHog is not bundled. Analytics is cookieless and anonymous
(PostHog EU). School/student mode turns it off completely: build with `VITE_SCHOOL_MODE=true`, or open the
app with `?mode=school` (sticky on that device; `?mode=home` turns it back off).

## Licensing

App code: proprietary, all rights reserved (see [LICENSE](LICENSE)). Stockfish (GPL-3.0) runs as a separate program in a Web Worker;
see [docs/stockfish-source.md](docs/stockfish-source.md). Board: react-chessboard (MIT). Rules: chess.js (BSD-2-Clause).
Puzzles: Lichess puzzle database (CC0).
