/**
 * triviaService.ts
 *
 * Strategy:
 *  1. Check if the topic is BROAD enough that opentdb is a good match.
 *     - "history" → opentdb History category ✓
 *     - "WWII" → too specific, opentdb History would return off-topic Qs → skip
 *     - "NBA 1960s" → no opentdb category at all → skip
 *  2. If opentdb is suitable: fetch from it, then top up with AI if needed.
 *  3. If opentdb is NOT suitable: go straight to AI (which can target exact topics).
 */

import { generateTriviaQuestions, type TriviaQuestion } from "./openrouter";
import { assessOpentdbSuitability, fetchFromOpentdb } from "./opentdb";

const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

const questionCache = new Map<
  string,
  { expiresAt: number; questions: TriviaQuestion[] }
>();

function normalizeTopic(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildCacheKey(
  topic: string,
  count: number,
  difficulty: "easy" | "medium" | "hard" | "random",
): string {
  return `${normalizeTopic(topic)}|${count}|${difficulty}`;
}

function hasUniqueOptions(options: string[]): boolean {
  const normalized = options.map((o) => o.trim().toLowerCase());
  return new Set(normalized).size === options.length;
}

function isLikelyMathTopic(topic: string): boolean {
  return /\b(math|algebra|geometry|calculus|arithmetic|numbers|percent|probability|statistics|equation|formula)\b/i.test(topic);
}

function parseNumericOption(option: string): number | null {
  const cleaned = option.replace(/[^0-9.+\-eE]/g, "").trim();
  if (cleaned.length === 0) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function isMathQuestionReasonable(question: TriviaQuestion): boolean {
  if (!/\d/.test(question.question)) return true;
  const values = question.options.map(parseNumericOption);
  if (values.some((v) => v === null)) return false;
  return new Set(values).size > 1;
}

export function isValidQuestion(question: any): question is TriviaQuestion {
  if (!question || typeof question !== "object") return false;
  if (typeof question.question !== "string" || question.question.trim().length === 0) return false;
  if (!Array.isArray(question.options) || question.options.length !== 4) return false;
  if (!hasUniqueOptions(question.options)) return false;
  if (typeof question.correctIndex !== "number" || question.correctIndex < 0 || question.correctIndex >= 4) return false;
  if (typeof question.explanation !== "string" || question.explanation.trim().length === 0) return false;
  if (question.difficulty !== undefined && !["easy", "medium", "hard"].includes(question.difficulty)) return false;
  return question.options.every((o: any) => typeof o === "string" && o.trim().length > 0);
}

function sanitizeQuestion(q: TriviaQuestion): TriviaQuestion {
  return {
    question: q.question.trim(),
    options: q.options.map((o) => o.trim()),
    correctIndex: q.correctIndex,
    explanation: q.explanation.trim(),
    difficulty: q.difficulty,
  };
}

function deduplicateQuestions(
  primary: TriviaQuestion[],
  secondary: TriviaQuestion[],
): TriviaQuestion[] {
  const seen = new Set(primary.map((q) => q.question.toLowerCase()));
  return [...primary, ...secondary.filter((q) => !seen.has(q.question.toLowerCase()))];
}

export async function fetchValidatedTriviaQuestions(
  topic: string,
  count: number,
  difficulty: "easy" | "medium" | "hard" | "random" = "random",
): Promise<TriviaQuestion[]> {
  const cacheKey = buildCacheKey(topic, count, difficulty);
  const cached = questionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.questions.slice(0, count);
  }

  const isMathTopic = isLikelyMathTopic(topic);
  const filter = (q: TriviaQuestion) =>
    isValidQuestion(q) && (isMathTopic ? isMathQuestionReasonable(q) : true);

  // ── Step 1: Should we use opentdb at all? ─────────────────────────────────
  const suitability = assessOpentdbSuitability(topic);
  console.info(`[triviaService] opentdb suitability for "${topic}": ${suitability.suitable} — ${suitability.reason}`);

  let verifiedQuestions: TriviaQuestion[] = [];

  if (suitability.suitable && suitability.categoryId !== null) {
    try {
      const raw = await fetchFromOpentdb(suitability.categoryId, count, difficulty);
      verifiedQuestions = raw.filter(filter).map(sanitizeQuestion);
      console.info(`[triviaService] opentdb returned ${verifiedQuestions.length}/${count} valid questions`);
    } catch (err) {
      console.warn("[triviaService] opentdb fetch failed:", err);
    }
  } else {
    console.info(`[triviaService] skipping opentdb — going straight to AI for specific topic "${topic}"`);
  }

  // ── Step 2: Fill remaining with AI ───────────────────────────────────────
  let finalQuestions = verifiedQuestions;

  if (finalQuestions.length < count) {
    const needed = count - finalQuestions.length;
    console.info(`[triviaService] requesting ${needed} AI questions for "${topic}"`);

    try {
      const aiRaw = await generateTriviaQuestions(topic, needed, difficulty);
      const aiValid = aiRaw.filter(filter).map(sanitizeQuestion);
      finalQuestions = deduplicateQuestions(verifiedQuestions, aiValid).slice(0, count);
      console.info(`[triviaService] final total: ${finalQuestions.length}/${count} questions`);
    } catch (aiErr) {
      console.error("[triviaService] AI generation failed:", aiErr);
      if (finalQuestions.length === 0) throw aiErr;
    }
  }

  if (finalQuestions.length === 0) {
    throw new Error("Could not fetch any valid questions. Please try a different topic.");
  }

  const result = finalQuestions.slice(0, count);
  questionCache.set(cacheKey, { questions: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}
