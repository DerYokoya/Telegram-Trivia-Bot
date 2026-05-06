import {
  generateTriviaQuestions,
  type TriviaQuestion,
} from "./openrouter";

const CACHE_TTL_MS = 1000 * 60 * 30;

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

export async function fetchValidatedTriviaQuestions(
  topic: string,
  count: number,
  difficulty: "easy" | "medium" | "hard" | "random" = "random",
): Promise<TriviaQuestion[]> {
  const cacheKey = buildCacheKey(topic, count, difficulty);
  const cached = questionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.questions.map((question) => ({
      ...question,
      options: question.options.map((option) => option),
    }));
  }

  const questions = await generateTriviaQuestions(topic, count, difficulty);
  const validQuestions = questions
    .filter(isValidQuestion)
    .filter((question) =>
      isLikelyMathTopic(topic) ? isMathQuestionReasonable(question) : true,
    )
    .map(sanitizeQuestion);

  if (validQuestions.length < count) {
    throw new Error(
      "AI returned invalid or low-confidence questions. Please choose a different topic or try again.",
    );
  }

  const result = validQuestions.slice(0, count);
  questionCache.set(cacheKey, {
    questions: result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return result;
}
