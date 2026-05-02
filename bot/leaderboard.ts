// ─── Types ───────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  userId: number;
  nickname: string;
  topic: string;
  category: string;
  correct: number;
  total: number;
  avgSpeedMs: number;
  recordedAt: number;
}

// ─── In-memory store ──────────────────────────────────────────────────────────

const entries: LeaderboardEntry[] = [];

// ─── Write ────────────────────────────────────────────────────────────────────

export function recordResult(entry: LeaderboardEntry): void {
  entries.push(entry);
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
