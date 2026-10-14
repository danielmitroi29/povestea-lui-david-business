import { Pool } from "pg";

/*
 * Un singur pool pentru tot procesul. In dev, Next reincarca modulele la fiecare
 * modificare; fara `globalThis` s-ar deschide un pool nou de fiecare data.
 */
const g = globalThis as unknown as { pgPool?: Pool };

export const pool: Pool = g.pgPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
if (process.env.NODE_ENV !== "production") g.pgPool = pool;
