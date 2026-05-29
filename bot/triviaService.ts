/**
 * triviaService.ts
 *
 * Strategy (in order):
 *  1. Fetch from Open Trivia DB (human-verified, free, no key needed)
 *  2. If opentdb returns fewer questions than requested, top up with AI generation
 *
 * This eliminates the main source of wrong answers: AI hallucinating trivia facts.
 */

import {
  generateTriviaQuestions,
  type TriviaQuestion,
} from "./openrouter";
import { fetchFromOpentdb } from "./opentdb";

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
  const normalized = options.map((option) => option.trim().toLowerCase());
  return new Set(normalized).size === options.length;
}

function isLikelyMathTopic(topic: string): boolean {
  return /\b(math|algebra|geometry|calculus|arithmetic|numbers|percent|probability|statistics|equation|formula)\b/i.test(
    topic,
  );
}

function parseNumericOption(option: string): number | null {
  const cleaned = option.replace(/[^0-9.+\-eE]/g, "").trim();
  if (cleaned.length === 0) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function isMathQuestionReasonable(question: TriviaQuestion): boolean {
  if (!/\d/.test(question.question)) {
    return true;
  }
  const values = question.options.map(parseNumericOption);
  if (values.some((value) => value === null)) {
    return false;
  }
  const uniqueValues = new Set(values);
  return uniqueValues.size > 1;
}

export function isValidQuestion(question: any): question is TriviaQuestion {
  if (!question || typeof question !== "object") return false;
  if (typeof question.question !== "string" || question.question.trim().length === 0)
    return false;
  if (!Array.isArray(question.options) || question.options.length !== 4) return false;
  if (!hasUniqueOptions(question.options)) return false;
  if (
    typeof question.correctIndex !== "number" ||
    question.correctIndex < 0 ||
    question.correctIndex >= 4
  )
    return false;
  if (
    typeof question.explanation !== "string" ||
    question.explanation.trim().length === 0
  )
    return false;
  if (
    question.difficulty !== undefined &&
    !["easy", "medium", "hard"].includes(question.difficulty)
  )
    return false;
  return question.options.every(
    (option: any) => typeof option === "string" && option.trim().length > 0,
  );
}

function sanitizeQuestion(question: TriviaQuestion): TriviaQuestion {
  return {
    question: question.question.trim(),
    options: question.options.map((option) => option.trim()),
    correctIndex: question.correctIndex,
    explanation: question.explanation.trim(),
    difficulty: question.difficulty,
  };
}

/** Remove duplicate questions (same question text) across two arrays */
function deduplicateQuestions(
  primary: TriviaQuestion[],
  secondary: TriviaQuestion[],
): TriviaQuestion[] {
  const seen = new Set(primary.map((q) => q.question.toLowerCase()));
  const unique = secondary.filter((q) => !seen.has(q.question.toLowerCase()));
  return [...primary, ...unique];
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

  // ── Step 1: Fetch from Open Trivia DB (human-verified) ──────────────────
  let verifiedQuestions: TriviaQuestion[] = [];
  try {
    const raw = await fetchFromOpentdb(topic, count, difficulty);
    verifiedQuestions = raw
      .filter(isValidQuestion)
      .filter((q) => (isLikelyMathTopic(topic) ? isMathQuestionReasonable(q) : true))
      .map(sanitizeQuestion);
    console.info(`[triviaService] opentdb returned ${verifiedQuestions.length}/${count} questions for "${topic}"`);
  } catch (err) {
    console.warn("[triviaService] opentdb fetch failed, continuing to AI:", err);
  }

  // ── Step 2: Top up with AI if opentdb didn't return enough ──────────────
  let finalQuestions = verifiedQuestions;

  if (finalQuestions.length < count) {
    const needed = count - finalQuestions.length;
    console.info(`[triviaService] requesting ${needed} AI-generated questions for "${topic}"`);

    try {
      const aiRaw = await generateTriviaQuestions(topic, needed, difficulty);
      const aiValid = aiRaw
        .filter(isValidQuestion)
        .filter((q) => (isLikelyMathTopic(topic) ? isMathQuestionReasonable(q) : true))
        .map(sanitizeQuestion);

      // Merge, dropping any AI questions that duplicate verified ones
      finalQuestions = deduplicateQuestions(verifiedQuestions, aiValid).slice(0, count);
      console.info(
        `[triviaService] after AI top-up: ${finalQuestions.length}/${count} questions`,
      );
    } catch (aiErr) {
      console.error("[triviaService] AI generation failed:", aiErr);
      // If we have at least 1 verified question, use what we have; otherwise rethrow
      if (finalQuestions.length === 0) {
        throw aiErr;
      }
    }
  }

  if (finalQuestions.length === 0) {
    throw new Error(
      "Could not fetch any valid questions. Please try a different topic.",
    );
  }

  // It's fine to return fewer than `count` if both sources came up short;
  // the caller (quiz runner) should handle variable-length question arrays.
  const result = finalQuestions.slice(0, count);

  questionCache.set(cacheKey, {
    questions: result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return result;
}
