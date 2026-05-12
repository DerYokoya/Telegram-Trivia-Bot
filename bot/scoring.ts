// scoring.ts
export interface ScoreParams {
  correct: number;
  total: number;
  avgSpeedMs: number;
  difficulty: "easy" | "medium" | "hard" | "random";
  topicComplexity?: number;
}

const DIFFICULTY_MULTIPLIERS = {
  easy: 1.0,
  medium: 1.5,
  hard: 2.0,
  random: 1.2, // Average expected
};

const SPEED_BONUS_THRESHOLDS = [
  { maxMs: 5000, multiplier: 1.3 },   // <5s: 30% bonus
  { maxMs: 10000, multiplier: 1.15 },  // <10s: 15% bonus
  { maxMs: 20000, multiplier: 1.05 },  // <20s: 5% bonus
];

export function calculateWeightedScore(params: ScoreParams): number {
  const accuracy = params.total > 0 ? params.correct / params.total : 0;
  const difficultyMulti = DIFFICULTY_MULTIPLIERS[params.difficulty] ?? 1.0;
  
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