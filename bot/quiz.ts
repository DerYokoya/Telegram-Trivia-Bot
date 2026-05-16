import type { TriviaQuestion } from "./openrouter";

export type QuizPhase =
  | "idle"
  | "awaiting_topic"
  | "awaiting_count"
  | "awaiting_difficulty"
  | "loading"
  | "in_progress"
  | "finished"
  | "awaiting_nickname"
  | "awaiting_leaderboard_category";

export interface QuestionResult {
  question: string;
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
  timeMs: number;
}

// quiz.ts - Add to QuizSession interface
export interface QuizSession {
  chatId: number;
  phase: QuizPhase;
  topic: string | null;
  desiredCount: number | null;
  difficulty: "easy" | "medium" | "hard" | "random";
  questions: TriviaQuestion[];
  questionDifficulties: Array<"easy" | "medium" | "hard">; // NEW
  currentIndex: number;
  results: QuestionResult[];
  questionStartedAt: number | null;
  quizStartedAt: number | null;
  activeMessageId: number | null;
  nickname: string | null;
}

const sessions = new Map<number, QuizSession>();

export function getSession(chatId: number): QuizSession {
  let s = sessions.get(chatId);
  if (!s) {
    s = createSession(chatId);
    sessions.set(chatId, s);
  }
  return s;
}

export function createSession(chatId: number): QuizSession {
  const fresh: QuizSession = {
    chatId,
    phase: "idle",
    topic: null,
    desiredCount: null,
    difficulty: "random",
    questions: [],
    questionDifficulties: [], // NEW
    currentIndex: 0,
    results: [],
    questionStartedAt: null,
    quizStartedAt: null,
    activeMessageId: null,
    nickname: null,
  };
  sessions.set(chatId, fresh);
  return fresh;
}

export function resetSession(chatId: number): QuizSession {
  return createSession(chatId);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = Math.round(ms / 100) / 10;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds - minutes * 60);
  return `${minutes}m ${seconds}s`;
}
