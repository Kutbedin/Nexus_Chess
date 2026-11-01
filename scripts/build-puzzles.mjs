// Builds curated puzzle packs from the Lichess puzzle database (CC0).
// Usage: node scripts/build-puzzles.mjs [path-or-url-to-lichess_db_puzzle.csv.zst | --repack]
// Output: public/puzzles/index.json + public/puzzles/pack-NN.json (rating-sorted, 200–250 per pack).
// --repack re-validates and re-chunks the committed packs without downloading.
import { Chess } from 'chess.js'
import { createReadStream, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { Readable, Transform } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { createZstdDecompress } from 'node:zlib'

const SOURCE = process.argv[2] ?? 'https://database.lichess.org/lichess_db_puzzle.csv.zst'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'puzzles')
const PACK_SIZE = 250
const MAX_ROWS = 3_000_000

// Priority order decides the primary theme when a puzzle has several.
const THEMES = [
  ['backRankMate', 180],
  ['mateIn1', 300],
  ['mateIn2', 240],
  ['fork', 280],
  ['pin', 200],
  ['skewer', 150],
  ['discoveredAttack', 150],
  ['hangingPiece', 210],
  ['deflection', 120],
  ['trappedPiece', 100],
  ['promotion', 100],
]
const THEME_IDS = new Set(THEMES.map(([t]) => t))
// Rating bands skew easy: the audience is mostly beginners.
const BANDS = [
  [0, 800, 0.25],
  [800, 1100, 0.25],
  [1100, 1400, 0.2],
  [1400, 1700, 0.15],
  [1700, 2000, 0.1],
  [2000, 4000, 0.05],
]

const quota = new Map()
for (const [theme, total] of THEMES) {
  BANDS.forEach(([, , share], i) => quota.set(`${theme}:${i}`, Math.max(1, Math.round(total * share))))
}
const remaining = () => [...quota.values()].reduce((a, b) => a + b, 0)

/** Returns a normalized puzzle or a rejection reason. */
export function validate(row) {
  const [id, fen, moves, rating, deviation, popularity, plays, themes] = row.split(',')
  const uci = moves.split(' ')
  if (Number(popularity) < 85 || Number(plays) < 500 || Number(deviation) > 90) return null
  if (uci.length < 2 || uci.length > 8) return null
  const tags = themes.split(' ')
  const primary = THEMES.find(([t]) => tags.includes(t))?.[0]
  if (!primary) return null
  const chess = new Chess(fen)
  try {
    chess.move(uci[0])
  } catch {
    return { reject: `${id}: illegal setup move` }
  }
  const start = chess.fen()
  for (const m of uci.slice(1)) {
    try {
      chess.move(m)
    } catch {
      return { reject: `${id}: illegal solution move ${m}` }
    }
  }
  if (tags.includes('mate') && !chess.isCheckmate()) return { reject: `${id}: mate theme without mate` }
  return {
    id,
    fen: start,
    setup: uci[0],
    moves: uci.slice(1),
    rating: Number(rating),
    primary,
    themes: tags.filter((t) => THEME_IDS.has(t)),
  }
}

/**
 * Lichess compresses with pzstd: every zstd frame is preceded by a skippable frame whose
 * 4-byte payload is the next frame's compressed size. Node's decoder rejects skippable
 * frames, so strip them and forward only the real frames.
 */
function stripSkippableFrames() {
  let buf = Buffer.alloc(0)
  let passThrough = 0
  return new Transform({
    transform(chunk, _enc, done) {
      buf = Buffer.concat([buf, chunk])
      for (;;) {
        if (passThrough > 0) {
          const n = Math.min(passThrough, buf.length)
          if (n === 0) break
          this.push(buf.subarray(0, n))
          buf = buf.subarray(n)
          passThrough -= n
          continue
        }
        if (buf.length < 8) break
        const magic = buf.readUInt32LE(0)
        if ((magic & 0xfffffff0) !== 0x184d2a50) {
          passThrough = Infinity
          continue
        }
        const size = buf.readUInt32LE(4)
        if (buf.length < 8 + size) break
        if (size === 4) passThrough = buf.readUInt32LE(8)
        buf = buf.subarray(8 + size)
      }
      done()
    },
  })
}

async function openLines() {
  const raw = SOURCE.startsWith('http') ? Readable.fromWeb((await fetch(SOURCE)).body) : createReadStream(SOURCE)
  return createInterface({ input: raw.pipe(stripSkippableFrames()).pipe(createZstdDecompress()), crlfDelay: Infinity })
}

const picked = []
const rejects = []
let rows = 0
if (SOURCE === '--repack') {
  for (const f of readdirSync(OUT).filter((f) => f.startsWith('pack-'))) {
    for (const p of JSON.parse(readFileSync(join(OUT, f), 'utf8'))) {
      const chess = new Chess(p.fen)
      for (const m of p.moves) chess.move(m)
      picked.push(p)
    }
  }
}
const lines = SOURCE === '--repack' ? [] : await openLines()
for await (const line of lines) {
  if (rows++ === 0 || !line) continue
  const p = validate(line)
  if (!p) continue
  if ('reject' in p) {
    rejects.push(p.reject)
    continue
  }
  const band = BANDS.findIndex(([lo, hi]) => p.rating >= lo && p.rating < hi)
  const key = `${p.primary}:${band}`
  if ((quota.get(key) ?? 0) <= 0) continue
  quota.set(key, quota.get(key) - 1)
  picked.push(p)
  if (remaining() === 0 || rows > MAX_ROWS) break
}
if (SOURCE !== '--repack') lines.close()

picked.sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id))
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const packs = []
// Even chunks: ceil(total / 250) packs, so every pack holds 200–250 puzzles.
const packCount = Math.ceil(picked.length / PACK_SIZE)
const per = Math.ceil(picked.length / packCount)
for (let i = 0; i < picked.length; i += per) {
  const chunk = picked.slice(i, i + per)
  const id = String(packs.length + 1).padStart(2, '0')
  const file = `pack-${id}.json`
  writeFileSync(join(OUT, file), JSON.stringify(chunk.map(({ primary, ...rest }) => ({ ...rest, primary }))))
  const themeCounts = {}
  for (const p of chunk) themeCounts[p.primary] = (themeCounts[p.primary] ?? 0) + 1
  packs.push({ id, file, count: chunk.length, minRating: chunk[0].rating, maxRating: chunk.at(-1).rating, themeCounts })
}
writeFileSync(
  join(OUT, 'index.json'),
  JSON.stringify(
    {
      version: 1,
      source: 'Lichess puzzle database (CC0), https://database.lichess.org/#puzzles',
      generatedAt: new Date().toISOString().slice(0, 10),
      total: picked.length,
      packs,
    },
    null,
    2,
  ) + '\n',
)
console.log(`rows scanned: ${rows}, picked: ${picked.length}, rejected: ${rejects.length}` + (SOURCE === "--repack" ? "" : `, unfilled quota: ${remaining()}`))
if (rejects.length) console.log(rejects.slice(0, 10).join('\n'))
