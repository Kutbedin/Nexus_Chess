import { STORAGE_KEYS } from '../storageKeys'

const KEY = STORAGE_KEYS.schoolMode

/**
 * School/student mode disables analytics completely (nothing is loaded or sent).
 * On when built with VITE_SCHOOL_MODE=true, or after opening the app with `?mode=school`
 * (sticky until `?mode=home`). Classroom seat codes will switch it on in Phase 1b.
 */
export function resolveSchoolMode(search: string, storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null, buildFlag: string | undefined): boolean {
  const mode = new URLSearchParams(search).get('mode')
  if (mode === 'school') storage?.setItem(KEY, '1')
  if (mode === 'home') storage?.removeItem(KEY)
  return buildFlag === 'true' || storage?.getItem(KEY) === '1'
}
