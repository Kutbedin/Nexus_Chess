/** The committed puzzle packs, keyed by file name (e.g. "index.json", "pack-01.json"). */
const modules = import.meta.glob<unknown>('/public/puzzles/*.json', { eager: true, import: 'default' })

export const PUZZLE_FILES: Readonly<Record<string, unknown>> = Object.fromEntries(
  Object.entries(modules).map(([path, data]) => [path.split('/').pop()!, data]),
)

/** fetch() stand-in serving `/puzzles/*` from the committed packs. */
export async function fetchPuzzleFile(url: string): Promise<Response> {
  const data = PUZZLE_FILES[url.split('/').pop()!]
  return data ? new Response(JSON.stringify(data), { status: 200 }) : new Response('not found', { status: 404 })
}
