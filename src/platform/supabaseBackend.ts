import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecordKind, SyncRecord } from '../core/storage/cloudSync'
import type { AccountLinkPort, CloudBackend } from '../core/storage/cloudSyncedStorage'

/** Tables from `supabase/migrations/0001_cloud_backup.sql`. */
export const SYNC_TABLES: Record<RecordKind, string> = {
  progress: 'player_progress',
  puzzles: 'puzzle_stats',
  revenge: 'revenge_puzzles',
}

const PAGE_SIZE = 1000
const UPSERT_CHUNK = 500

interface Row {
  id: string
  data: unknown
  updated_at: number | string
}

/**
 * Supabase implementation of the backup. Every visitor gets an anonymous auth user on first visit;
 * Row Level Security limits each user to their own rows, and a trigger keeps the newest copy per row.
 */
export class SupabaseBackend implements CloudBackend, AccountLinkPort {
  private readonly client: SupabaseClient
  private userId: string | null = null

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async ensureSession(): Promise<void> {
    const { data, error } = await this.client.auth.getSession()
    if (error) throw error
    if (data.session) {
      this.userId = data.session.user.id
      return
    }
    const signIn = await this.client.auth.signInAnonymously()
    if (signIn.error || !signIn.data.user) throw signIn.error ?? new Error('anonymous sign-in returned no user')
    this.userId = signIn.data.user.id
  }

  async pull(): Promise<SyncRecord[]> {
    const out: SyncRecord[] = []
    for (const [kind, table] of Object.entries(SYNC_TABLES) as [RecordKind, string][]) {
      // Page until an empty page: the project's "max rows" setting may cap pages below PAGE_SIZE.
      for (let from = 0; ; ) {
        const { data, error } = await this.client
          .from(table)
          .select('id,data,updated_at')
          .eq('user_id', this.requireUser())
          .order('id')
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw error
        const rows = (data ?? []) as Row[]
        if (rows.length === 0) break
        for (const r of rows) out.push({ kind, id: r.id, data: r.data, updatedAt: Number(r.updated_at) })
        from += rows.length
      }
    }
    return out
  }

  async push(records: readonly SyncRecord[]): Promise<void> {
    const userId = this.requireUser()
    for (const [kind, table] of Object.entries(SYNC_TABLES) as [RecordKind, string][]) {
      const rows = records.filter((r) => r.kind === kind).map((r) => ({ user_id: userId, id: r.id, data: r.data, updated_at: r.updatedAt }))
      for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
        const { error } = await this.client.from(table).upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: 'user_id,id' })
        if (error) throw error
      }
    }
  }

  async accountStatus(): Promise<'anonymous' | 'linked' | 'signedOut'> {
    const { data } = await this.client.auth.getSession()
    if (!data.session) return 'signedOut'
    return data.session.user.is_anonymous ? 'anonymous' : 'linked'
  }

  async requestEmailLink(email: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ email })
    if (error) throw error
  }

  private requireUser(): string {
    if (!this.userId) throw new Error('no session; call ensureSession() first')
    return this.userId
  }
}
