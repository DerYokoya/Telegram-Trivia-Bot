// scoring.ts
export interface ScoreParams {
  correct: number;
  total: number;
  avgSpeedMs: number;
  difficulty: "easy" | "medium" | "hard" | "random";
  /** Required when difficulty is "random" - array of per-question difficulties */
  questionDifficulties?: Array<"easy" | "medium" | "hard">;
  topicComplexity?: number;
}

const DIFFICULTY_MULTIPLIERS = {
  easy: 1.0,
  medium: 1.5,
  hard: 2.0,
};

const SPEED_BONUS_THRESHOLDS = [
  { maxMs: 5000, multiplier: 1.3 },   // <5s: 30% bonus
  { maxMs: 10000, multiplier: 1.15 },  // <10s: 15% bonus
  { maxMs: 20000, multiplier: 1.05 },  // <20s: 5% bonus
];

/**
 * Calculate effective difficulty multiplier for random quizzes
 * Uses weighted average of per-question difficulties
 * 
 * Example: 3 easy (1.0) + 2 hard (2.0) = (3*1.0 + 2*2.0) / 5 = 1.4
 */
function calculateRandomMultiplier(questionDifficulties: Array<"easy" | "medium" | "hard">): number {
  if (!questionDifficulties || questionDifficulties.length === 0) {
    return 1.2; // Default fallback for random
  }
  
  let totalMultiplier = 0;
  for (const diff of questionDifficulties) {
    totalMultiplier += DIFFICULTY_MULTIPLIERS[diff];
  }
  
  return totalMultiplier / questionDifficulties.length;
}

export function calculateDifficultyMultiplier(params: ScoreParams): number {
  if (params.difficulty !== "random") {
    return DIFFICULTY_MULTIPLIERS[params.difficulty];
  }
  
  // Random difficulty - use weighted average of actual questions
  if (params.questionDifficulties && params.questionDifficulties.length > 0) {
    return calculateRandomMultiplier(params.questionDifficulties);
  }
  
  // Fallback for random when no per-question data available
  // This assumes equal distribution (1/3 each)
  const avgMultiplier = 
    (DIFFICULTY_MULTIPLIERS.easy + 
     DIFFICULTY_MULTIPLIERS.medium + 
     DIFFICULTY_MULTIPLIERS.hard) / 3;
  
  return avgMultiplier;
}

export function calculateWeightedScore(params: ScoreParams): number {
  const accuracy = params.total > 0 ? params.correct / params.total : 0;
  const difficultyMulti = calculateDifficultyMultiplier(params);
  
  // Base score: 0-1000 points
  let baseScore = accuracy * 1000;
  
  // Apply difficulty multiplier
  baseScore *= difficultyMulti;
  
  // Apply speed bonus
  let speedMulti = 1.0;
  for (const threshold of SPEED_BONUS_THRESHOLDS) {
    if (params.avgSpeedMs < threshold.maxMs) {
      speedMulti = threshold.multiplier;
      break;
    }
  }
  
  // Additional bonus for perfect score
  const perfectBonus = accuracy === 1.0 ? 1.1 : 1.0;
  
  return Math.round(baseScore * speedMulti * perfectBonus);
}

export function formatLeaderboardScore(score: number): string {
  if (score >= 1000) return `🏆 ${score}`;
  if (score >= 500) return `⭐ ${score}`;
  return `${score}`;
}

/**
 * Get human-readable difficulty description for display
 */
export function getDifficultyDisplay(difficulty: string, questionDifficulties?: Array<"easy" | "medium" | "hard">): string {
  if (difficulty !== "random") {
    const icon = difficulty === "easy" ? "🟢" : difficulty === "medium" ? "🟡" : "🔴";
    return `${icon} ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
  }
  
  if (!questionDifficulties || questionDifficulties.length === 0) {
    return "🎲 Random";
  }
  
  // Count distribution
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const d of questionDifficulties) {
    counts[d]++;
  }
  
  const parts = [];
  if (counts.easy > 0) parts.push(`${counts.easy}🟢`);
  if (counts.medium > 0) parts.push(`${counts.medium}🟡`);
  if (counts.hard > 0) parts.push(`${counts.hard}🔴`);
  
  return `🎲 Random (${parts.join(" ").trim() || "mixed"})`;
}