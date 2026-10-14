import { pool } from "@/app/lib/db";
import { PLAN_NAME, freeStories, storiesPerMonth } from "@/app/lib/plans";

export interface Quota {
  subscribed: boolean;
  periodStart: Date;
  periodEnd: Date | null;
  limit: number;
  used: number;
}

const TRIAL_PERIOD = new Date(0);

/*
 * Perioada si limita curenta a utilizatorului: din abonamentul activ, daca are,
 * altfel proba gratuita (o singura data, pe toata viata contului).
 */
export async function getQuota(userId: string): Promise<Quota> {
  const { rows } = await pool.query(
    `SELECT "periodStart", "periodEnd" FROM subscription
      WHERE "referenceId" = $1 AND plan = $2 AND status IN ('active', 'trialing')
      ORDER BY "periodStart" DESC NULLS LAST LIMIT 1`,
    [userId, PLAN_NAME],
  ).catch(() => ({ rows: [] as { periodStart: Date | null; periodEnd: Date | null }[] }));
  // .catch: fara Stripe configurat, tabela `subscription` nu exista

  const sub = rows[0];
  const periodStart = sub ? (sub.periodStart ?? startOfMonth()) : TRIAL_PERIOD;
  const limit = sub ? storiesPerMonth() : freeStories();

  const usage = await pool.query(
    "SELECT used FROM story_usage WHERE user_id = $1 AND period_start = $2",
    [userId, periodStart],
  );
  return {
    subscribed: !!sub,
    periodStart,
    periodEnd: sub?.periodEnd ?? null,
    limit,
    used: usage.rows[0]?.used ?? 0,
  };
}

/*
 * Rezerva o poveste din cota, atomic: doua cereri simultane nu pot trece amandoua
 * de ultima poveste ramasa. Intoarce false daca cota e epuizata.
 */
export async function reserveStory(userId: string, q: Quota): Promise<boolean> {
  if (q.limit <= 0) return false;
  const { rowCount } = await pool.query(
    `INSERT INTO story_usage (user_id, period_start, used) VALUES ($1, $2, 1)
     ON CONFLICT (user_id, period_start)
     DO UPDATE SET used = story_usage.used + 1 WHERE story_usage.used < $3`,
    [userId, q.periodStart, q.limit],
  );
  return rowCount === 1;
}

/** Da inapoi povestea rezervata, cand generarea a esuat. */
export async function releaseStory(userId: string, q: Quota) {
  await pool.query(
    "UPDATE story_usage SET used = GREATEST(used - 1, 0) WHERE user_id = $1 AND period_start = $2",
    [userId, q.periodStart],
  );
}

function startOfMonth() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
