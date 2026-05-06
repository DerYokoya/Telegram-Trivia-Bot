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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      id SERIAL PRIMARY KEY,
      user_id bigint NOT NULL UNIQUE,
      gquiz_wins integer NOT NULL DEFAULT 0,
      gquiz_plays integer NOT NULL DEFAULT 0,
      quizzes_completed integer NOT NULL DEFAULT 0,
      perfect_quizzes integer NOT NULL DEFAULT 0,
      perfect_score_5 integer NOT NULL DEFAULT 0,
      perfect_score_10 integer NOT NULL DEFAULT 0,
      perfect_score_15 integer NOT NULL DEFAULT 0,
      perfect_score_20 integer NOT NULL DEFAULT 0,
      sub20s_achieved boolean NOT NULL DEFAULT false,
      sub10s_achieved boolean NOT NULL DEFAULT false,
      sub5s_achieved boolean NOT NULL DEFAULT false,
      first_correct_q1 boolean NOT NULL DEFAULT false,
      top5_global boolean NOT NULL DEFAULT false,
      top1_category boolean NOT NULL DEFAULT false,
      unlocked_badges text NOT NULL DEFAULT '[]',
      updated_at bigint NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_lifetime_stats (
      id SERIAL PRIMARY KEY,
      user_id bigint NOT NULL UNIQUE,
      total_questions integer NOT NULL DEFAULT 0,
      correct_answers integer NOT NULL DEFAULT 0,
      updated_at bigint NOT NULL
    );
  `);
}
