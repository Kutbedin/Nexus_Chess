import type { EnginePort } from './types'

export type EnginePurpose = 'play' | 'analysis'

/** Identifies the exact engine build we distribute (shown on the About page, required for GPL compliance). */
export interface EngineInfo {
  name: string
  version: string
  license: string
  /** Where the corresponding source of the distributed build can be obtained. */
  sourceUrl: string
  upstreamUrl: string
  /** Package coordinates and commit of the build, for reproducibility. */
  build: string
}

/**
 * Creates engines. Web uses Stockfish WASM workers; other platforms can swap in a
 * permissively licensed engine or a server-side engine without touching game code.
 */
export interface EngineProvider {
  readonly info: EngineInfo
  /** Returns a long-lived engine for the purpose; callers must not dispose shared instances. */
  get(purpose: EnginePurpose): EnginePort
}
