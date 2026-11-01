import { collectLines, parseBestMove, parseInfoLine } from '../core/engine/uci'
import type { EngineInfo, EnginePurpose, EngineProvider } from '../core/engine/provider'
import type { AnalyseOptions, CandidateLine, EnginePort } from '../core/engine/types'
import { STOCKFISH_SOURCE_URL } from '../config'

/**
 * Stockfish (GPL-3.0) runs as a separate program in a Web Worker, loaded from a static URL
 * and spoken to only via UCI text messages. Do not import Stockfish into the app bundle.
 * The files are copied from node_modules/stockfish by scripts/copy-engine.mjs.
 */
export const STOCKFISH_URL = `${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`

/** Exact build we ship. Keep in sync with package.json and docs/stockfish-source.md. */
export const STOCKFISH_INFO: EngineInfo = {
  name: 'Stockfish',
  version: '19 (Stockfish.js 19.0.1, lite single-threaded WASM)',
  license: 'GPL-3.0',
  sourceUrl: STOCKFISH_SOURCE_URL,
  upstreamUrl: 'https://github.com/nmrugg/stockfish.js/tree/v19.0.1',
  build: 'npm stockfish@19.0.1 · nmrugg/stockfish.js@0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6',
}

/** Web provider: one worker per purpose, so background analysis never delays the bot's move. */
export class StockfishWasmProvider implements EngineProvider {
  readonly info = STOCKFISH_INFO
  private readonly engines = new Map<EnginePurpose, EnginePort>()

  get(purpose: EnginePurpose): EnginePort {
    let engine = this.engines.get(purpose)
    if (!engine) {
      engine = new StockfishEngine()
      this.engines.set(purpose, engine)
    }
    return engine
  }
}

export class StockfishEngine implements EnginePort {
  private readonly worker: Worker
  private readonly ready: Promise<void>
  private queue: Promise<unknown> = Promise.resolve()
  private onLine: ((line: string) => void) | null = null

  constructor(url: string = STOCKFISH_URL) {
    this.worker = new Worker(url)
    this.worker.onmessage = (e: MessageEvent<string>) => this.onLine?.(String(e.data))
    this.ready = this.handshake()
  }

  analyse(fen: string, options: AnalyseOptions): Promise<CandidateLine[]> {
    const run = this.queue.then(() => this.runSearch(fen, options))
    this.queue = run.catch(() => undefined)
    return run
  }

  stop(): void {
    this.worker.postMessage('stop')
  }

  dispose(): void {
    this.worker.postMessage('quit')
    this.worker.terminate()
  }

  private send(cmd: string): void {
    this.worker.postMessage(cmd)
  }

  private waitFor(predicate: (line: string) => boolean, collect?: (line: string) => void): Promise<string> {
    return new Promise((resolve) => {
      this.onLine = (line) => {
        collect?.(line)
        if (predicate(line)) {
          this.onLine = null
          resolve(line)
        }
      }
    })
  }

  private async handshake(): Promise<void> {
    const uciok = this.waitFor((l) => l === 'uciok')
    this.send('uci')
    await uciok
    const ready = this.waitFor((l) => l === 'readyok')
    this.send('isready')
    await ready
  }

  private async runSearch(fen: string, options: AnalyseOptions): Promise<CandidateLine[]> {
    await this.ready
    const lines: CandidateLine[] = []
    const done = this.waitFor(
      (l) => l.startsWith('bestmove'),
      (l) => {
        const info = parseInfoLine(l)
        if (info) lines.push(info)
      },
    )
    this.send(`setoption name MultiPV value ${options.multiPv}`)
    this.send(`position fen ${fen}`)
    this.send(options.movetimeMs ? `go movetime ${options.movetimeMs}` : `go depth ${options.depth ?? 10}`)
    const last = await done
    const collected = collectLines(lines)
    if (collected.length === 0) {
      const best = parseBestMove(last)
      return best ? [{ rank: 1, depth: 0, score: { type: 'cp', value: 0 }, pv: [best] }] : []
    }
    return collected
  }
}
