/**
 * opentdb.ts
 *
 * Fetches human-verified trivia questions from the Open Trivia Database
 * (https://opentdb.com) — a free API with 4,000+ community-curated questions.
 *
 * Used as the PRIMARY source before falling back to AI generation.
 */

import type { TriviaQuestion } from "./openrouter";

const OPENTDB_BASE = "https://opentdb.com/api.php";

// opentdb difficulty maps 1:1 to our difficulty type
type OpentdbDifficulty = "easy" | "medium" | "hard";

interface OpentdbResponse {
  response_code: number; // 0 = success, 1 = no results, 2 = invalid param, etc.
  results: OpentdbQuestion[];
}

interface OpentdbQuestion {
  type: "multiple" | "boolean";
  difficulty: OpentdbDifficulty;
  category: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

// HTML entity decode (opentdb encodes entities like &amp; &#039; etc.)
function decodeHtml(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&hellip;/g, "…")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
}

function shuffleArray<T>(arr: T[]): { shuffled: T[]; originalIndices: number[] } {
  const indexed = arr.map((item, i) => ({ item, i }));
  for (let n = indexed.length - 1; n > 0; n--) {
    const j = Math.floor(Math.random() * (n + 1));
    [indexed[n], indexed[j]] = [indexed[j], indexed[n]];
  }
  return {
    shuffled: indexed.map((x) => x.item),
    originalIndices: indexed.map((x) => x.i),
  };
}

/**
 * Convert a raw opentdb question into our TriviaQuestion format.
 * Returns null if the question is boolean-only (not suitable as MCQ).
 */
function convertQuestion(raw: OpentdbQuestion): TriviaQuestion | null {
  if (raw.type !== "multiple") return null; // skip true/false questions
  if (raw.incorrect_answers.length !== 3) return null;

  const correctDecoded = decodeHtml(raw.correct_answer);
  const incorrectDecoded = raw.incorrect_answers.map(decodeHtml);
  const questionDecoded = decodeHtml(raw.question);

  // Build a 4-option array: [correct, ...incorrect], then shuffle
  const allOptions = [correctDecoded, ...incorrectDecoded];
  const { shuffled, originalIndices } = shuffleArray(allOptions);

  // Find where the correct answer ended up after shuffle
  const correctIndexAfterShuffle = originalIndices.indexOf(0); // original index 0 was the correct answer

  return {
    question: questionDecoded,
    options: shuffled,
    correctIndex: correctIndexAfterShuffle,
    explanation: `The correct answer is: ${correctDecoded}`,
    difficulty: raw.difficulty,
  };
}

/**
 * Attempt to fetch questions from opentdb.
 *
 * opentdb doesn't support arbitrary topic search — it uses numeric category IDs.
 * We map common topic keywords to category IDs, then fall back to "any category".
 * The caller should fall back to AI if this returns fewer questions than needed.
 */
export async function fetchFromOpentdb(
  topic: string,
  count: number,
  difficulty: "easy" | "medium" | "hard" | "random" = "random",
): Promise<TriviaQuestion[]> {
  const categoryId = topicToCategoryId(topic);
  const difficultyParam =
    difficulty === "random" ? "" : `&difficulty=${difficulty}`;
  const categoryParam = categoryId ? `&category=${categoryId}` : "";

  // opentdb caps at 50 per request; request a few extra to account for
  // boolean questions that get filtered out.
  const requestCount = Math.min(50, count + 5);

  const url =
    `${OPENTDB_BASE}?amount=${requestCount}&type=multiple${difficultyParam}${categoryParam}`;

  let resp: Response;
  try {
    resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (err) {
    // Network failure — caller will fall back to AI
    console.warn("[opentdb] fetch failed:", err);
    return [];
  }

  if (!resp.ok) {
    console.warn("[opentdb] HTTP error:", resp.status);
    return [];
  }

  let data: OpentdbResponse;
  try {
    data = (await resp.json()) as OpentdbResponse;
  } catch {
    console.warn("[opentdb] JSON parse failed");
    return [];
  }

  // response_code 0 = OK, 1 = no results for params
  if (data.response_code !== 0 || !Array.isArray(data.results)) {
    console.info("[opentdb] no results (code", data.response_code, ")");
    return [];
  }

  const converted = data.results
    .map(convertQuestion)
    .filter((q): q is TriviaQuestion => q !== null);

  return converted.slice(0, count);
}

// ---------------------------------------------------------------------------
// Topic → opentdb category mapping
// opentdb category list: https://opentdb.com/api_category.php
// ---------------------------------------------------------------------------

const CATEGORY_MAP: Array<{ patterns: RegExp; id: number }> = [
  { patterns: /\b(general|trivia|mixed|random|everything)\b/i, id: 9 },
  { patterns: /\b(book|literature|novel|fiction)\b/i, id: 10 },
  { patterns: /\b(film|movie|cinema|hollywood)\b/i, id: 11 },
  { patterns: /\b(music|song|band|album|artist)\b/i, id: 12 },
  { patterns: /\b(musical|theatre|theater|broadway)\b/i, id: 13 },
  { patterns: /\b(television|tv show|sitcom|series)\b/i, id: 14 },
  { patterns: /\b(video game|gaming|game|console|playstation|xbox|nintendo)\b/i, id: 15 },
  { patterns: /\b(board game|card game|tabletop)\b/i, id: 16 },
  { patterns: /\b(science|nature|biology|chemistry|physics|scientific)\b/i, id: 17 },
  { patterns: /\b(computer|programming|software|internet|technology|tech|coding)\b/i, id: 18 },
  { patterns: /\b(math|mathematics|algebra|geometry|calculus|arithmetic)\b/i, id: 19 },
  { patterns: /\b(mythology|myth|legend|gods?|zeus|thor|olympus)\b/i, id: 20 },
  { patterns: /\b(sport|sports|football|soccer|basketball|baseball|tennis|olympic)\b/i, id: 21 },
  { patterns: /\b(geography|country|countries|capital|continent|map)\b/i, id: 22 },
  { patterns: /\b(history|historical|ancient|war|revolution|empire)\b/i, id: 23 },
  { patterns: /\b(politics|government|politician|election|president|democracy)\b/i, id: 24 },
  { patterns: /\b(celebrity|famous|pop culture|entertainment)\b/i, id: 26 },
  { patterns: /\b(animal|animals|wildlife|mammal|bird|fish|insect|reptile)\b/i, id: 27 },
  { patterns: /\b(vehicle|car|automobile|motorcycle|truck|aviation|aircraft)\b/i, id: 28 },
  { patterns: /\b(comic|superhero|marvel|dc |batman|superman)\b/i, id: 29 },
  { patterns: /\b(gadget|electronics|device|appliance)\b/i, id: 30 },
  { patterns: /\b(anime|manga|japanese animation)\b/i, id: 31 },
  { patterns: /\b(cartoon|animation|animated)\b/i, id: 32 },
];

function topicToCategoryId(topic: string): number | null {
  for (const entry of CATEGORY_MAP) {
    if (entry.patterns.test(topic)) return entry.id;
  }
  return null; // no match → opentdb will return questions from any category
}
