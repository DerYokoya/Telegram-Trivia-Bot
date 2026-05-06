// ─── Achievement definitions ──────────────────────────────────────────────────

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const ALL_ACHIEVEMENTS: Achievement[] = [
  // ── gquiz wins ──
  { id: "gquiz_win_1", icon: "🏅", name: "First Blood", description: "Win 1 group quiz" },
  { id: "gquiz_win_5", icon: "🥈", name: "Group Dominator", description: "Win 5 group quizzes" },
  { id: "gquiz_win_10", icon: "🥇", name: "Quiz Champion", description: "Win 10 group quizzes" },

  // ── solo completions ──
  { id: "quiz_complete_1", icon: "📝", name: "First Quiz", description: "Complete 1 solo quiz" },
  { id: "quiz_complete_5", icon: "📚", name: "Quiz Regular", description: "Complete 5 solo quizzes" },
  { id: "quiz_complete_10", icon: "🎓", name: "Quiz Scholar", description: "Complete 10 solo quizzes" },

  // ── perfect scores ──
  { id: "perfect_5", icon: "⭐", name: "Flawless Five", description: "Answer every question correctly in a 5-question quiz" },
  { id: "perfect_10", icon: "🌟", name: "Perfect Ten", description: "Answer every question correctly in a 10-question quiz" },
  { id: "perfect_15", icon: "💫", name: "Fifteen and Flawless", description: "Answer every question correctly in a 15-question quiz" },
  { id: "perfect_20", icon: "✨", name: "The Perfectionist", description: "Answer every question correctly in a 20-question quiz" },

  // ── speed ──
  { id: "speed_sub20", icon: "⚡", name: "Quick Draw", description: "Average under 20 seconds per question" },
  { id: "speed_sub10", icon: "🚀", name: "Lightning", description: "Average under 10 seconds per question" },
  { id: "speed_sub5", icon: "💥", name: "Speed Demon", description: "Average under 5 seconds per question" },

  // ── perfect streak ──
  { id: "perfect_streak_3", icon: "🔥", name: "On Fire", description: "Complete 3 perfect quizzes" },

  // ── gquiz participation ──
  { id: "gquiz_played_1", icon: "🎮", name: "Group Player", description: "Participate in 1 group quiz" },
  { id: "gquiz_played_5", icon: "🕹️", name: "Group Veteran", description: "Participate in 5 group quizzes" },
  { id: "gquiz_played_10", icon: "👑", name: "Group Legend", description: "Participate in 10 group quizzes" },

  // ── special ──
  { id: "first_q1_correct", icon: "🎯", name: "First Strike", description: "Be first to correctly answer Q1 in a group quiz" },
  { id: "top5_global", icon: "🌍", name: "Global Elite", description: "Appear in the top 5 of the global leaderboard" },
  { id: "top1_category", icon: "🏆", name: "Category King", description: "Be #1 in any category leaderboard" },
];

const ACHIEVEMENT_MAP = new Map<string, Achievement>(
  ALL_ACHIEVEMENTS.map((a) => [a.id, a]),
);

// ─── Per-user stats ───────────────────────────────────────────────────────────

export interface UserAchievementStats {
  userId: number;
  gquizWins: number;
  gquizPlays: number;
  quizzesCompleted: number;
  perfectQuizzes: number;
  perfectScore5: number;
  perfectScore10: number;
  perfectScore15: number;
  perfectScore20: number;
  sub20sAchieved: boolean;
  sub10sAchieved: boolean;
  sub5sAchieved: boolean;
  firstCorrectQ1: boolean;
  top5Global: boolean;
  top1Category: boolean;
  unlocked: Set<string>;
}

import { pool } from "./db";

const userStats = new Map<number, UserAchievementStats>();
const LOADED_USERS = new Set<number>();

async function loadUserStats(userId: number): Promise<UserAchievementStats> {
  if (LOADED_USERS.has(userId)) {
    return userStats.get(userId)!;
  }

  if (!pool) {
    return createEmptyStats(userId);
  }

  try {
    const result = await pool.query(
      `SELECT * FROM user_achievements WHERE user_id = $1`,
      [userId],
    );
    if (result.rows.length > 0) {
      const row = result.rows[0]!;
      const s: UserAchievementStats = {
        userId,
        gquizWins: Number(row.gquiz_wins),
        gquizPlays: Number(row.gquiz_plays),
        quizzesCompleted: Number(row.quizzes_completed),
        perfectQuizzes: Number(row.perfect_quizzes),
        perfectScore5: Number(row.perfect_score_5),
        perfectScore10: Number(row.perfect_score_10),
        perfectScore15: Number(row.perfect_score_15),
        perfectScore20: Number(row.perfect_score_20),
        sub20sAchieved: row.sub20s_achieved,
        sub10sAchieved: row.sub10s_achieved,
        sub5sAchieved: row.sub5s_achieved,
        firstCorrectQ1: row.first_correct_q1,
        top5Global: row.top5_global,
        top1Category: row.top1_category,
        unlocked: new Set(JSON.parse(row.unlocked_badges)),
      };
      userStats.set(userId, s);
      LOADED_USERS.add(userId);
      return s;
    }
  } catch (error) {
    console.error("Failed to load user achievements:", error);
  }

  return createEmptyStats(userId);
}

function createEmptyStats(userId: number): UserAchievementStats {
  const s: UserAchievementStats = {
    userId,
    gquizWins: 0,
    gquizPlays: 0,
    quizzesCompleted: 0,
    perfectQuizzes: 0,
    perfectScore5: 0,
    perfectScore10: 0,
    perfectScore15: 0,
    perfectScore20: 0,
    sub20sAchieved: false,
    sub10sAchieved: false,
    sub5sAchieved: false,
    firstCorrectQ1: false,
    top5Global: false,
    top1Category: false,
    unlocked: new Set(),
  };
  userStats.set(userId, s);
  LOADED_USERS.add(userId);
  return s;
}

async function saveUserStats(s: UserAchievementStats): Promise<void> {
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO user_achievements (
        user_id, gquiz_wins, gquiz_plays, quizzes_completed, perfect_quizzes,
        perfect_score_5, perfect_score_10, perfect_score_15, perfect_score_20,
        sub20s_achieved, sub10s_achieved, sub5s_achieved, first_correct_q1,
        top5_global, top1_category, unlocked_badges, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (user_id) DO UPDATE SET
        gquiz_wins = $2, gquiz_plays = $3, quizzes_completed = $4, perfect_quizzes = $5,
        perfect_score_5 = $6, perfect_score_10 = $7, perfect_score_15 = $8, perfect_score_20 = $9,
        sub20s_achieved = $10, sub10s_achieved = $11, sub5s_achieved = $12, first_correct_q1 = $13,
        top5_global = $14, top1_category = $15, unlocked_badges = $16, updated_at = $17`,
      [
        s.userId,
        s.gquizWins,
        s.gquizPlays,
        s.quizzesCompleted,
        s.perfectQuizzes,
        s.perfectScore5,
        s.perfectScore10,
        s.perfectScore15,
        s.perfectScore20,
        s.sub20sAchieved,
        s.sub10sAchieved,
        s.sub5sAchieved,
        s.firstCorrectQ1,
        s.top5Global,
        s.top1Category,
        JSON.stringify(Array.from(s.unlocked)),
        Date.now(),
      ],
    );
  } catch (error) {
    console.error("Failed to save user achievements:", error);
  }
}

export async function getUserStats(userId: number): Promise<UserAchievementStats> {
  return loadUserStats(userId);
}

function getUserStatSync(userId: number): UserAchievementStats {
  if (!userStats.has(userId)) {
    return createEmptyStats(userId);
  }
  return userStats.get(userId)!;
}


// ─── Achievement check ────────────────────────────────────────────────────────

function checkAchievements(stats: UserAchievementStats): string[] {
  const newlyUnlocked: string[] = [];

  const checks: Array<[string, boolean]> = [
    ["gquiz_win_1", stats.gquizWins >= 1],
    ["gquiz_win_5", stats.gquizWins >= 5],
    ["gquiz_win_10", stats.gquizWins >= 10],
    ["quiz_complete_1", stats.quizzesCompleted >= 1],
    ["quiz_complete_5", stats.quizzesCompleted >= 5],
    ["quiz_complete_10", stats.quizzesCompleted >= 10],
    ["perfect_5", stats.perfectScore5 >= 1],
    ["perfect_10", stats.perfectScore10 >= 1],
    ["perfect_15", stats.perfectScore15 >= 1],
    ["perfect_20", stats.perfectScore20 >= 1],
    ["speed_sub20", stats.sub20sAchieved],
    ["speed_sub10", stats.sub10sAchieved],
    ["speed_sub5", stats.sub5sAchieved],
    ["perfect_streak_3", stats.perfectQuizzes >= 3],
    ["gquiz_played_1", stats.gquizPlays >= 1],
    ["gquiz_played_5", stats.gquizPlays >= 5],
    ["gquiz_played_10", stats.gquizPlays >= 10],
    ["first_q1_correct", stats.firstCorrectQ1],
    ["top5_global", stats.top5Global],
    ["top1_category", stats.top1Category],
  ];

  for (const [id, met] of checks) {
    if (met && !stats.unlocked.has(id)) {
      stats.unlocked.add(id);
      newlyUnlocked.push(id);
    }
  }

  return newlyUnlocked;
}

// ─── Public update helpers ────────────────────────────────────────────────────

/** Called after a solo quiz finishes. Returns list of newly unlocked achievement IDs. */
export async function recordSoloQuizComplete(
  userId: number,
  correct: number,
  total: number,
  avgSpeedMs: number,
): Promise<string[]> {
  const s = await getUserStats(userId);
  s.quizzesCompleted += 1;

  const isPerfect = correct === total && total > 0;
  if (isPerfect) {
    s.perfectQuizzes += 1;
    if (total === 5) s.perfectScore5 += 1;
    if (total === 10) s.perfectScore10 += 1;
    if (total === 15) s.perfectScore15 += 1;
    if (total === 20) s.perfectScore20 += 1;
  }

  const avgSec = avgSpeedMs / 1000;
  if (avgSec < 20) s.sub20sAchieved = true;
  if (avgSec < 10) s.sub10sAchieved = true;
  if (avgSec < 5) s.sub5sAchieved = true;

  const newAchs = checkAchievements(s);
  await saveUserStats(s);
  return newAchs;
}

/** Called when a group quiz finishes for a participant. Returns new achievement IDs. */
export async function recordGroupQuizParticipation(
  userId: number,
  isWinner: boolean,
  correct: number,
  total: number,
  avgCorrectSpeedMs: number,
): Promise<string[]> {
  const s = await getUserStats(userId);
  s.gquizPlays += 1;
  if (isWinner) s.gquizWins += 1;

  const isPerfect = correct === total && total > 0;
  if (isPerfect) {
    s.perfectQuizzes += 1;
    if (total === 5) s.perfectScore5 += 1;
    if (total === 10) s.perfectScore10 += 1;
    if (total === 15) s.perfectScore15 += 1;
    if (total === 20) s.perfectScore20 += 1;
  }

  if (correct > 0) {
    const avgSec = avgCorrectSpeedMs / 1000;
    if (avgSec < 20) s.sub20sAchieved = true;
    if (avgSec < 10) s.sub10sAchieved = true;
    if (avgSec < 5) s.sub5sAchieved = true;
  }

  const newAchs = checkAchievements(s);
  await saveUserStats(s);
  return newAchs;
}

/** Called when a user is first correct on Q1 in a group quiz. */
export async function recordFirstQ1Correct(userId: number): Promise<string[]> {
  const s = await getUserStats(userId);
  s.firstCorrectQ1 = true;
  const newAchs = checkAchievements(s);
  await saveUserStats(s);
  return newAchs;
}

/** Called when leaderboard positions are updated. */
export async function recordLeaderboardPosition(
  userId: number,
  isTop5Global: boolean,
  isTop1Category: boolean,
): Promise<string[]> {
  const s = await getUserStats(userId);
  if (isTop5Global) s.top5Global = true;
  if (isTop1Category) s.top1Category = true;
  const newAchs = checkAchievements(s);
  await saveUserStats(s);
  return newAchs;
}

// ─── Render ───────────────────────────────────────────────────────────────────

export async function renderAchievements(userId: number): Promise<string> {
  const s = await getUserStats(userId);
  const total = ALL_ACHIEVEMENTS.length;
  const unlocked = s.unlocked.size;

  const lines: string[] = [];
  lines.push(`<b>🏆 Achievements (${unlocked}/${total})</b>`);
  lines.push("");

  for (const ach of ALL_ACHIEVEMENTS) {
    const done = s.unlocked.has(ach.id);
    if (done) {
      lines.push(`${ach.icon} <b>${ach.name}</b> ✅`);
      lines.push(`   <i>${ach.description}</i>`);
    } else {
      lines.push(`🔒 <b>${ach.name}</b>`);
      lines.push(`   <i>${ach.description}</i>`);
    }
  }

  return lines.join("\n");
}

export function renderNewAchievements(ids: string[]): string {
  if (ids.length === 0) return "";
  const lines: string[] = ["", "🎉 <b>Achievement unlocked!</b>"];
  for (const id of ids) {
    const ach = ACHIEVEMENT_MAP.get(id);
    if (ach) lines.push(`${ach.icon} <b>${ach.name}</b> — ${ach.description}`);
  }
  return lines.join("\n");
}
