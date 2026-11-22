// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/0001_cloud_backup.sql?raw'

/** Just enough of Supabase for the migration: roles, auth.users, auth.uid(), default table grants. */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`

const ALICE = '00000000-0000-0000-0000-00000000000a'
const BOB = '00000000-0000-0000-0000-00000000000b'

describe('supabase/migrations/0001_cloud_backup.sql', () => {
  let db: PGlite

  async function as(user: string | null, sql: string, params: unknown[] = []) {
    await db.exec('reset role')
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user ?? ''])
    await db.exec(`set role ${user ? 'authenticated' : 'anon'}`)
    try {
      return await db.query<Record<string, unknown>>(sql, params)
    } finally {
      await db.exec('reset role')
    }
  }

  beforeAll(async () => {
    db = new PGlite()
    await db.exec(SUPABASE_STUB)
    await db.exec(migration)
    await db.exec(migration)
    await db.query('insert into auth.users (id) values ($1), ($2)', [ALICE, BOB])
  }, 30_000)

  it('each anonymous user reads and writes only their own rows', async () => {
    await as(ALICE, `insert into player_progress (id, data, updated_at) values ('w1-1', '{"completed":true,"stars":3,"attempts":1}', 100)`)
    await as(BOB, `insert into player_progress (id, data, updated_at) values ('w1-1', '{"completed":false,"stars":0,"attempts":1}', 100)`)

    expect((await as(ALICE, 'select user_id, data from player_progress')).rows).toEqual([
      { user_id: ALICE, data: { completed: true, stars: 3, attempts: 1 } },
    ])
    await expect(as(BOB, `insert into revenge_puzzles (user_id, id, data, updated_at) values ($1, 'g:1', '{}', 1)`, [ALICE])).rejects.toThrow(
      /row-level security/,
    )
    await as(BOB, `update player_progress set updated_at = 999 where user_id = $1`, [ALICE])
    await as(BOB, `delete from player_progress where user_id = $1`, [ALICE])
    expect((await as(ALICE, 'select updated_at from player_progress')).rows).toEqual([{ updated_at: 100 }])
  })

  it('signed-out visitors get no access at all', async () => {
    await expect(as(null, 'select * from puzzle_stats')).rejects.toThrow(/permission denied/)
  })

  it('an upsert with an older timestamp keeps the newer stored copy', async () => {
    const upsert = `insert into puzzle_stats (id, data, updated_at) values ('p1', $1, $2)
      on conflict (user_id, id) do update set data = excluded.data, updated_at = excluded.updated_at`
    await as(ALICE, upsert, [{ firstTry: true, at: 500 }, 500])
    await as(ALICE, upsert, [{ firstTry: false, at: 200 }, 200])
    expect((await as(ALICE, `select data, updated_at from puzzle_stats where id = 'p1'`)).rows).toEqual([{ data: { firstTry: true, at: 500 }, updated_at: 500 }])
    await as(ALICE, upsert, [{ firstTry: false, at: 600 }, 600])
    expect((await as(ALICE, `select updated_at from puzzle_stats where id = 'p1'`)).rows).toEqual([{ updated_at: 600 }])
  })

  it('rejects oversized or non-object payloads', async () => {
    await expect(as(ALICE, `insert into revenge_puzzles (id, data, updated_at) values ('g:2', '[1]', 1)`)).rejects.toThrow(/check constraint/)
    await expect(as(ALICE, `insert into player_progress (id, data, updated_at) values ($1, '{}', 1)`, ['x'.repeat(65)])).rejects.toThrow(/check constraint/)
  })
})
