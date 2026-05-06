import { pool } from "./db";

const lifetimeStats = new Map<number, { total: number; correct: number }>();
const LOADED_USERS = new Set<number>();

async function loadUserLifetimeStats(
  userId: number,
): Promise<{ total: number; correct: number }> {
  if (LOADED_USERS.has(userId)) {
    return lifetimeStats.get(userId) ?? { total: 0, correct: 0 };
  }

  if (!pool) {
    const stats = { total: 0, correct: 0 };
    lifetimeStats.set(userId, stats);
    LOADED_USERS.add(userId);
    return stats;
  }

  try {
    const result = await pool.query(
      `SELECT total_questions, correct_answers FROM user_lifetime_stats WHERE user_id = $1`,
      [userId],
    );
    if (result.rows.length > 0) {
      const row = result.rows[0]!;
      const stats = {
        total: Number(row.total_questions),
        correct: Number(row.correct_answers),
      };
      lifetimeStats.set(userId, stats);
      LOADED_USERS.add(userId);
      return stats;
    }
  } catch (error) {
    console.error("Failed to load user lifetime stats:", error);
  }

  const stats = { total: 0, correct: 0 };
  lifetimeStats.set(userId, stats);
  LOADED_USERS.add(userId);
  return stats;
}

async function saveUserLifetimeStats(
  userId: number,
  stats: { total: number; correct: number },
): Promise<void> {
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO user_lifetime_stats (user_id, total_questions, correct_answers, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         total_questions = $2, correct_answers = $3, updated_at = $4`,
      [userId, stats.total, stats.correct, Date.now()],
    );
  } catch (error) {
    console.error("Failed to save user lifetime stats:", error);
  }
}

export async function getLifetimeStats(
  userId: number,
): Promise<{ total: number; correct: number }> {
  return loadUserLifetimeStats(userId);
}

export async function addToLifetimeStats(
  userId: number,
  correct: number,
  total: number,
): Promise<void> {
  const stats = await loadUserLifetimeStats(userId);
  stats.total += total;
  stats.correct += correct;
  lifetimeStats.set(userId, stats);
  await saveUserLifetimeStats(userId, stats);
}
