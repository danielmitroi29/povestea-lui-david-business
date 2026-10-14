import { getMigrations } from "better-auth/db/migration";
import { authOptions } from "@/app/lib/auth";
import { pool } from "@/app/lib/db";

/*
 * Creeaza tabelele la pornirea serverului (din instrumentation.ts), ca deploy-ul
 * pe Railway sa nu ceara un pas manual. Tabelele Better Auth (user, session,
 * account, verification, subscription) le creeaza biblioteca; pe ale noastre
 * le cream cu SQL idempotent.
 */
export async function ensureSchema() {
  const { runMigrations } = await getMigrations(authOptions);
  await runMigrations();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS story (
      id            text PRIMARY KEY,
      user_id       text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      title         text NOT NULL,
      text          text NOT NULL,
      names         jsonb NOT NULL,
      age           int,
      duration      int,
      custom_prompt text,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS story_user_created ON story (user_id, created_at DESC);

    -- Audio-ul fiecarei bucati de poveste, ca reascultarea sa nu mai coste
    CREATE TABLE IF NOT EXISTS story_audio (
      story_id text NOT NULL REFERENCES story(id) ON DELETE CASCADE,
      idx      int  NOT NULL,
      mp3      bytea NOT NULL,
      PRIMARY KEY (story_id, idx)
    );

    -- Cate povesti noi a generat un utilizator intr-o perioada de facturare.
    -- period_start = inceputul perioadei din abonament; pentru proba gratuita, epoch.
    CREATE TABLE IF NOT EXISTS story_usage (
      user_id      text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      period_start timestamptz NOT NULL,
      used         int NOT NULL,
      PRIMARY KEY (user_id, period_start)
    );
  `);
}
