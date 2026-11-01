# Stockfish — source and license

Nexus Chess runs the Stockfish chess engine as a separate program inside a Web Worker.
Stockfish is free software licensed under the GNU General Public License v3 (see `Copying.txt`
next to this file). Nexus Chess communicates with it only through the UCI text protocol.
The Nexus Chess application code itself is proprietary (all rights reserved); the engine is not.

## Exact build we distribute

| Item | Value |
| --- | --- |
| Engine | Stockfish 19, "lite" single-threaded WASM build (`stockfish-19-lite-single.js` + `.wasm`) |
| Packaging | Stockfish.js by Nathan Rugg and contributors |
| npm package | `stockfish@19.0.1` (pinned exactly in `package.json`), tarball shasum `c557a1b9f075a67f38e01332c6db7472d8df744e` |
| Source tag | https://github.com/nmrugg/stockfish.js/tree/v19.0.1 |
| Source commit | `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6` (tag object `8d9ca57043594a8fa6ae0b73fb685d9105bf51df`) |
| `stockfish-19-lite-single.js` sha256 | `ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a` |
| `stockfish-19-lite-single.wasm` sha256 | `ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de` |
| Upstream Stockfish | https://github.com/official-stockfish/Stockfish |

We ship the files unmodified, copied from the npm package by `scripts/copy-engine.mjs`.

## Corresponding source

- Public mirror of the exact source we ship (placeholder until created):
  https://github.com/Kutbedin/stockfish-wasm-fork — fork of `nmrugg/stockfish.js` at the commit above,
  including build instructions and the neural-network file reference.
- Written offer: for at least three years from the date we distribute this engine binary, we
  will provide the complete corresponding source code of the exact engine build we ship to anyone
  who asks. Contact: contact@nexuschess.com (placeholder until the domain is live).

## Swapping the engine

The app talks to engines through `EngineProvider` (`src/core/engine/provider.ts`). Web uses
`StockfishWasmProvider` (`src/platform/stockfishEngine.ts`). A permissively licensed engine or a
server-side engine (e.g. for iOS) can replace it without touching game code; update this file and
`STOCKFISH_INFO` (shown on the About page) whenever the distributed build changes.
