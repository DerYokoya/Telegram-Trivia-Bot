import type { TriviaQuestion } from "./openrouter";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GroupParticipant {
  userId: number;
  displayName: string;
  correct: number;
  wrong: number;
  totalCorrectMs: number;
  answerTimesMs: number[];
}

export interface GroupQuestionResult {
  questionIndex: number;
  winnerId: number | null;
  winnerName: string | null;
  winnerElapsedMs: number | null;
  correctIndex: number;
  allAnswers: Map<number, { choiceIndex: number; elapsedMs: number }>;
}

export type GroupPhase =
  | "idle"
  | "awaiting_topic"
  | "awaiting_count"
  | "awaiting_difficulty"
  | "loading"
  | "in_progress"
  | "finished";

export interface GroupQuizSession {
  lastAnswerAttempt: Map<number, number>;
  chatId: number;
  phase: GroupPhase;
  topic: string | null;
  desiredCount: number | null;
  difficulty: "easy" | "medium" | "hard" | "random";
  questions: TriviaQuestion[];
  questionDifficulties: Array<"easy" | "medium" | "hard">;
  currentIndex: number;
  quizStartedAt: number | null;
  questionStartedAt: number | null;
  activeMessageId: number | null;
  participants: Map<number, GroupParticipant>;
  results: GroupQuestionResult[];
  hostId: number;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const sessions = new Map<number, GroupQuizSession>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function freshSession(chatId: number, hostId: number): GroupQuizSession {
  return {
    chatId,
    phase: "idle",
    topic: null,
    desiredCount: null,
    difficulty: "random",
    questions: [],
    questionDifficulties: [],
    currentIndex: 0,
    quizStartedAt: null,
    questionStartedAt: null,
    activeMessageId: null,
    participants: new Map(),
    results: [],
    hostId,
    lastAnswerAttempt: new Map(),
  };
}

export function getGroupSession(
  chatId: number,
  hostId: number,
): GroupQuizSession {
  let s = sessions.get(chatId);
  if (!s) {
    s = freshSession(chatId, hostId);
    sessions.set(chatId, s);
  }
  return s;
}

export function resetGroupSession(
  chatId: number,
  hostId: number,
): GroupQuizSession {
  const s = freshSession(chatId, hostId);
  sessions.set(chatId, s);
  return s;
}

export function hasGroupSession(chatId: number): boolean {
  return sessions.has(chatId);
}

export function touchParticipant(
  session: GroupQuizSession,
  userId: number,
  displayName: string,
): GroupParticipant {
  let p = session.participants.get(userId);
  if (!p) {
    p = {
      userId,
      displayName,
      correct: 0,
      wrong: 0,
      totalCorrectMs: 0,
      answerTimesMs: [],
    };
    session.participants.set(userId, p);
  }
  return p;
}

// ─── Cooldown ─────────────────────────────────────────────────────────────────

const ANSWER_COOLDOWN_MS = 5000;

export type RegisterGroupAnswerResult =
  | "accepted_correct"
  | "accepted_wrong"
  | "on_cooldown"
  | "question_closed";

export function registerGroupAnswer(
  session: GroupQuizSession,
  userId: number,
  displayName: string,
  choiceIndex: number,
  elapsedMs: number,
): { status: RegisterGroupAnswerResult; cooldownRemainingMs?: number } {
  const result = session.results[session.currentIndex];
  if (!result) return { status: "question_closed" };

  const now = Date.now();
  const lastAttempt = session.lastAnswerAttempt.get(userId);

  if (lastAttempt !== undefined) {
    const elapsed = now - lastAttempt;
    if (elapsed < ANSWER_COOLDOWN_MS) {
      return {
        status: "on_cooldown",
        cooldownRemainingMs: ANSWER_COOLDOWN_MS - elapsed,
      };
    }
  }

  session.lastAnswerAttempt.set(userId, now);
  result.allAnswers.set(userId, { choiceIndex, elapsedMs });

  const p = touchParticipant(session, userId, displayName);
  p.answerTimesMs.push(elapsedMs);

  const isCorrect = choiceIndex === result.correctIndex;

  if (isCorrect) {
    p.correct += 1;
    p.totalCorrectMs += elapsedMs;
    if (result.winnerId === null) {
      result.winnerId = userId;
      result.winnerName = displayName;
      result.winnerElapsedMs = elapsedMs;
    }
    return { status: "accepted_correct" };
  } else {
    p.wrong += 1;
    return { status: "accepted_wrong" };
  }
}

export function getStandings(session: GroupQuizSession): GroupParticipant[] {
  const all = [...session.participants.values()];
  return all.sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct;
    const avgA = a.correct > 0 ? a.totalCorrectMs / a.correct : Infinity;
    const avgB = b.correct > 0 ? b.totalCorrectMs / b.correct : Infinity;
    if (avgA !== avgB) return avgA - avgB;
    return a.displayName.localeCompare(b.displayName);
  });
}
