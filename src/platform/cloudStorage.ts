import { emptyStamps, RECORD_KINDS, type SyncStamps } from '../core/storage/cloudSync'
import { CloudSyncedStorage, type StampStore } from '../core/storage/cloudSyncedStorage'
import type { StorageAdapter } from '../core/storage/storageAdapter'
import { STORAGE_KEYS } from '../storageKeys'
import { LocalStorageAdapter } from './localStorageAdapter'

export interface CloudConfig {
  url: string | undefined
  anonKey: string | undefined
  /** Shared classroom devices: no cloud backup, same as analytics. */
  schoolMode: boolean
}

export function cloudBackupEnabled(config: CloudConfig): boolean {
  return !config.schoolMode && Boolean(config.url?.trim()) && Boolean(config.anonKey?.trim())
}

export function localStampStore(storage: Storage): StampStore {
  return {
    load(): SyncStamps {
      const stamps = emptyStamps()
      try {
        const raw = JSON.parse(storage.getItem(STORAGE_KEYS.syncStamps) ?? '{}') as Partial<SyncStamps>
        for (const kind of RECORD_KINDS) if (raw[kind] && typeof raw[kind] === 'object') stamps[kind] = { ...raw[kind] }
      } catch {
        // Corrupt stamps only cost a re-upload; local data is untouched.
      }
      return stamps
    },
    save(stamps) {
      storage.setItem(STORAGE_KEYS.syncStamps, JSON.stringify(stamps))
    },
  }
}

/**
 * Local storage, plus Supabase backup when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
 * Without them (CI, local dev, school mode) this is exactly the plain local adapter and supabase-js is never loaded.
 */
export async function createStorage(config: CloudConfig, storage: Storage = window.localStorage): Promise<StorageAdapter> {
  const local = new LocalStorageAdapter(storage)
  if (!cloudBackupEnabled(config)) return local
  try {
    const [{ createClient }, { SupabaseBackend }] = await Promise.all([import('@supabase/supabase-js'), import('./supabaseBackend')])
    const client = createClient(config.url!.trim(), config.anonKey!.trim(), {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
    const cloud = new CloudSyncedStorage({
      local,
      stamps: localStampStore(storage),
      backend: new SupabaseBackend(client),
      now: Date.now,
      isOnline: () => navigator.onLine,
    })
    window.addEventListener('online', () => void cloud.syncNow())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void cloud.flush()
    })
    void cloud.start()
    return cloud
  } catch {
    // supabase-js chunk unavailable (first visit offline): stay local this session.
    return local
  }
}
