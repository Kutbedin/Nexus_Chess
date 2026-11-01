/** Returns a float in [0, 1). Injected everywhere randomness matters so tests stay deterministic. */
export type Rng = () => number

/** Mulberry32: tiny, fast, seedable PRNG. Not cryptographic. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pickWeighted<T>(items: readonly T[], weights: readonly number[], rng: Rng): T {
  if (items.length === 0) throw new Error('pickWeighted: empty list')
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0)
  if (total <= 0) return items[0]
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, weights[i])
    if (r < 0) return items[i]
  }
  return items[items.length - 1]
}
