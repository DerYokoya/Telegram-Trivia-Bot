// ─── Types ───────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  userId: number;
  nickname: string;
  topic: string;
  /** Normalised category (lower-cased, trimmed) */
  category: string;
  correct: number;
  total: number;
  /** Average milliseconds per correct answer across the quiz */
  avgSpeedMs: number;
  /** Unix timestamp (ms) when the record was set */
  recordedAt: number;
}

// ─── In-memory store ──────────────────────────────────────────────────────────
// For production you'd swap this for a database. The API surface stays the same.

const entries: LeaderboardEntry[] = [];

// ─── Write ────────────────────────────────────────────────────────────────────

export function recordResult(entry: LeaderboardEntry): void {
  entries.push(entry);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/** All-topics leaderboard: ranked by correct desc → avgSpeedMs asc. */
export function getGlobalLeaderboard(limit = 10): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      const pctA = a.total ? a.correct / a.total : 0;
      const pctB = b.total ? b.correct / b.total : 0;
      if (pctB !== pctA) return pctB - pctA;
      return a.avgSpeedMs - b.avgSpeedMs;
    })
    .slice(0, limit);
}

/**
 * Category leaderboard.
 * Matches entries whose `category` contains every word in the query
 * (case-insensitive). E.g. query "science" matches "sciences", "science & tech".
 */
export function getCategoryLeaderboard(
  categoryQuery: string,
  limit = 10,
): LeaderboardEntry[] {
  const words = categoryQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const matched = entries.filter((e) =>
    words.every((w) => e.category.includes(w)),
  );

  return matched
    .sort((a, b) => {
      const pctA = a.total ? a.correct / a.total : 0;
      const pctB = b.total ? b.correct / b.total : 0;
      if (pctB !== pctA) return pctB - pctA;
      return a.avgSpeedMs - b.avgSpeedMs;
    })
    .slice(0, limit);
}