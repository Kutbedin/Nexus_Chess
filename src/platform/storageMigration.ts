import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../storageKeys'

export { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../storageKeys'

const PAIRS: readonly [legacy: string, next: string][] = [
  [LEGACY_STORAGE_KEYS.locale, STORAGE_KEYS.locale],
  [LEGACY_STORAGE_KEYS.firstOpen, STORAGE_KEYS.firstOpen],
  [LEGACY_STORAGE_KEYS.schoolMode, STORAGE_KEYS.schoolMode],
  [LEGACY_STORAGE_KEYS.progress, STORAGE_KEYS.progress],
  [LEGACY_STORAGE_KEYS.revenge, STORAGE_KEYS.revenge],
  [LEGACY_STORAGE_KEYS.puzzles, STORAGE_KEYS.puzzles],
]

/** Copies legacy keys into GambitZone keys when the new key is unset (idempotent). */
export function migrateLegacyLocalStorage(storage: Storage): void {
  for (const [legacy, next] of PAIRS) {
    if (storage.getItem(next) === null) {
      const value = storage.getItem(legacy)
      if (value !== null) storage.setItem(next, value)
    }
  }
}
