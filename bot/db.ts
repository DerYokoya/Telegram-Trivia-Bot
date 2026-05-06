import { Pool } from "pg";

const DATABASE_URL = process.env["DATABASE_URL"];

export const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL })
  : null;

export async function initDatabase(): Promise<void> {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id SERIAL PRIMARY KEY,
      user_id bigint NOT NULL,
      nickname text NOT NULL,
      topic text NOT NULL,
      category text NOT NULL,
      difficulty text NOT NULL,
      correct integer NOT NULL,
      total integer NOT NULL,
      avg_speed_ms integer NOT NULL,
      recorded_at bigint NOT NULL
    );
  `);
}
