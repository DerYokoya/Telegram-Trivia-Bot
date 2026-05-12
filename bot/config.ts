// config.ts
export const Config = {
  // Quiz settings
  MAX_QUESTIONS: 20,
  MIN_QUESTIONS: 5,
  DEFAULT_QUESTIONS: 10,
  
  // Time limits
  QUIZ_COOLDOWN_MS: 30_000,
  GROUP_ANSWER_COOLDOWN_MS: 5000,
  
  // Leaderboard
  LEADERBOARD_DEFAULT_LIMIT: 10,
  
  // Cache
  QUESTION_CACHE_TTL_MS: 1000 * 60 * 30, // 30 minutes
  
  // Rate limiting
  MAX_QUIZZES_PER_HOUR: 10,
  
  // Validation
  MAX_TOPIC_LENGTH: 120,
  MIN_TOPIC_LENGTH: 2,
  MAX_NICKNAME_LENGTH: 24,
  
  // Scoring
  PERFECT_SCORE_BONUS: 1.1,
  SPEED_BONUS_THRESHOLDS: [
    { maxMs: 5000, multiplier: 1.3 },
    { maxMs: 10000, multiplier: 1.15 },
    { maxMs: 20000, multiplier: 1.05 },
  ],
} as const;