import { initDatabase, pool } from "./db";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  userId: number;
  nickname: string;
  topic: string;
  category: string;
  difficulty: "easy" | "medium" | "hard" | "random";
  correct: number;
  total: number;
  avgSpeedMs: number;
  recordedAt: number;
}

// ─── In-memory store ──────────────────────────────────────────────────────────

const entries: LeaderboardEntry[] = [];

// ─── Initialization ──────────────────────────────────────────────────────────

export async function initLeaderboardStore(): Promise<void> {
  if (!pool) return;
  try {
    await initDatabase();
    const result = await pool.query(
      `SELECT user_id, nickname, topic, category, difficulty, correct, total, avg_speed_ms, recorded_at FROM leaderboard ORDER BY recorded_at ASC`,
    );
    entries.length = 0;
    for (const row of result.rows) {
      entries.push({
        userId: Number(row.user_id),
        nickname: row.nickname,
        topic: row.topic,
        category: row.category,
        difficulty: row.difficulty,
        correct: Number(row.correct),
        total: Number(row.total),
        avgSpeedMs: Number(row.avg_speed_ms),
        recordedAt: Number(row.recorded_at),
      });
    }
  } catch (error) {
    console.error("Failed to initialize leaderboard store:", error);
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export function recordResult(entry: LeaderboardEntry): void {
  entries.push(entry);
  if (!pool) return;

  void pool
    .query(
      `INSERT INTO leaderboard (user_id, nickname, topic, category, difficulty, correct, total, avg_speed_ms, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        entry.userId,
        entry.nickname,
        entry.topic,
        entry.category,
        entry.difficulty,
        entry.correct,
        entry.total,
        Math.round(entry.avgSpeedMs),
        entry.recordedAt,
      ],
    )
    .catch((err: unknown) => {
      console.error("Failed to persist leaderboard entry:", err);
    });
}

export function clearLeaderboard(): void {
  entries.length = 0;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

function scoreOf(e: LeaderboardEntry): number {
  return e.total ? e.correct / e.total : 0;
}

export function getGlobalLeaderboard(limit = 10): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      const pctDiff = scoreOf(b) - scoreOf(a);
      if (pctDiff !== 0) return pctDiff;
      return a.avgSpeedMs - b.avgSpeedMs;
    })
    .slice(0, limit);
}

function normalizeCategory(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function categoryWords(text: string): string[] {
  return normalizeCategory(text).split(/\s+/).filter(Boolean);
}

export function getCategoryLeaderboard(
  categoryQuery: string,
  limit = 10,
): LeaderboardEntry[] {
  const words = categoryWords(categoryQuery);
  if (words.length === 0) return [];

  const matched = entries.filter((e) => {
    const entryWords = categoryWords(e.category);
    return words.every((word) => entryWords.includes(word));
  });

  return matched
    .sort((a, b) => {
      const pctDiff = scoreOf(b) - scoreOf(a);
      if (pctDiff !== 0) return pctDiff;
      return a.avgSpeedMs - b.avgSpeedMs;
    })
    .slice(0, limit);
}

/** Returns true if the user appears in the top-N global entries. */
export function isUserInTopNGlobal(userId: number, n: number): boolean {
  const top = getGlobalLeaderboard(n);
  return top.some((e) => e.userId === userId);
}

/** Returns true if the user is rank 1 in any category. */
export function isUserTop1InAnyCategory(userId: number): boolean {
  const categories = new Set(entries.map((e) => e.category));
  for (const cat of categories) {
    const top = getCategoryLeaderboard(cat, 1);
    if (top.length > 0 && top[0]!.userId === userId) return true;
  }
  return false;
}
