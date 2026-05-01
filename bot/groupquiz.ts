import type { TriviaQuestion } from "./openrouter";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GroupParticipant {
  userId: number;
  /** Display name used in Telegram (first name or username) */
  displayName: string;
  correct: number;
  wrong: number;
  /** Total elapsed ms across questions where this user answered correctly */
  totalCorrectMs: number;
  /** Answer times per question (ms), regardless of correctness */
  answerTimesMs: number[];
}

/**
 * Per-question record of who answered and when.
 * Only the first correct answer is honoured.
 */
export interface GroupQuestionResult {
  questionIndex: number;
  winnerId: number | null;
  winnerName: string | null;
  winnerElapsedMs: number | null;
  correctIndex: number;
  /** userId → { choiceIndex, elapsedMs } for everyone who tapped */
  allAnswers: Map<number, { choiceIndex: number; elapsedMs: number }>;
}

export type GroupPhase =
  | "idle"
  | "awaiting_topic"
  | "awaiting_count"
  | "loading"
  | "in_progress"
  | "finished";

export interface GroupQuizSession {
  chatId: number;
  phase: GroupPhase;
  topic: string | null;
  desiredCount: number | null;
  questions: TriviaQuestion[];
  currentIndex: number;
  /** ms timestamp when quiz started */
  quizStartedAt: number | null;
  /** ms timestamp when current question was sent */
  questionStartedAt: number | null;
  activeMessageId: number | null;
  participants: Map<number, GroupParticipant>;
  results: GroupQuestionResult[];
  /** userId of whoever initiated the quiz (used for admin commands) */
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
    questions: [],
    currentIndex: 0,
    quizStartedAt: null,
    questionStartedAt: null,
    activeMessageId: null,
    participants: new Map(),
    results: [],
    hostId,
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

/** Ensure participant exists; returns the record. */
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

/**
 * Try to register an answer.
 * Returns: "accepted_correct" | "accepted_wrong" | "already_answered" | "question_closed"
 */
export function registerGroupAnswer(
  session: GroupQuizSession,
  userId: number,
  displayName: string,
  choiceIndex: number,
  elapsedMs: number,
): "accepted_correct" | "accepted_wrong" | "already_answered" | "question_closed" {
  const result = session.results[session.currentIndex];
  if (!result) return "question_closed";

  if (result.allAnswers.has(userId)) return "already_answered";

  result.allAnswers.set(userId, { choiceIndex, elapsedMs });

  const p = touchParticipant(session, userId, displayName);
  p.answerTimesMs.push(elapsedMs);

  const isCorrect = choiceIndex === result.correctIndex;

  if (isCorrect) {
    p.correct += 1;
    p.totalCorrectMs += elapsedMs;

    // First correct answer wins
    if (result.winnerId === null) {
      result.winnerId = userId;
      result.winnerName = displayName;
      result.winnerElapsedMs = elapsedMs;
    }
    return "accepted_correct";
  } else {
    p.wrong += 1;
    return "accepted_wrong";
  }
}

/** Sorted standings: correct desc → avgSpeed asc → alphabetical */
export function getStandings(
  session: GroupQuizSession,
): GroupParticipant[] {
  const all = [...session.participants.values()];
  return all.sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct;
    const avgA = a.correct > 0 ? a.totalCorrectMs / a.correct : Infinity;
    const avgB = b.correct > 0 ? b.totalCorrectMs / b.correct : Infinity;
    if (avgA !== avgB) return avgA - avgB;
    return a.displayName.localeCompare(b.displayName);
  });
}