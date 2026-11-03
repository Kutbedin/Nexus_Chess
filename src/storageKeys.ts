/** Legacy localStorage keys from the Nexus Chess product name (rebrand → GambitZone). */
export const LEGACY_STORAGE_KEYS = {
  locale: 'nexus.locale',
  firstOpen: 'nexus.firstOpen',
  schoolMode: 'nexus.schoolMode',
  progress: 'nexus.progress.v1',
  revenge: 'nexus.revenge.v1',
  puzzles: 'nexus.puzzles.v1',
} as const

export const STORAGE_KEYS = {
  locale: 'gambitzone.locale',
  firstOpen: 'gambitzone.firstOpen',
  schoolMode: 'gambitzone.schoolMode',
  progress: 'gambitzone.progress.v1',
  revenge: 'gambitzone.revenge.v1',
  puzzles: 'gambitzone.puzzles.v1',
} as const
