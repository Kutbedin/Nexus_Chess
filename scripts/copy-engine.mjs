// Copies the Stockfish WASM build (GPL-3.0) into public/engine so it is served as a
// separate program and never bundled into our JS. Runs before dev, build, and test.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'stockfish')
const dest = join(root, 'public', 'engine')

mkdirSync(dest, { recursive: true })
for (const file of ['bin/stockfish-19-lite-single.js', 'bin/stockfish-19-lite-single.wasm', 'Copying.txt']) {
  copyFileSync(join(src, file), join(dest, file.replace('bin/', '')))
}
copyFileSync(join(root, 'docs', 'stockfish-source.md'), join(dest, 'SOURCE.md'))
console.log('Stockfish engine copied to public/engine')
