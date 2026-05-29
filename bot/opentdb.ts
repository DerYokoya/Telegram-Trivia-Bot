/**
 * opentdb.ts
 *
 * Fetches human-verified trivia questions from the Open Trivia Database
 * (https://opentdb.com) — a free API with 4,000+ community-curated questions.
 *
 * KEY DESIGN DECISION:
 *   opentdb uses broad fixed categories (e.g. "History", "Sports").
 *   If the user's topic is MORE SPECIFIC than a category (e.g. "WWII", "NBA 1960s"),
 *   opentdb will return off-topic questions from the whole category.
 *
 *   Rules:
 *   - If the topic maps to a specific category AND the topic IS that category
 *     (e.g. topic = "history" → category 23 "History") → use opentdb.
 *   - If the topic is a sub-topic (e.g. "WWII", "NBA 1960s", "Roman Empire") →
 *     skip opentdb entirely; go straight to AI which can target the exact topic.
 *   - If no category match at all → skip opentdb (random questions would be useless).
 */

import type { TriviaQuestion } from "./openrouter";

const OPENTDB_BASE = "https://opentdb.com/api.php";

type OpentdbDifficulty = "easy" | "medium" | "hard";

interface OpentdbResponse {
  response_code: number;
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

function convertQuestion(raw: OpentdbQuestion): TriviaQuestion | null {
  if (raw.type !== "multiple") return null;
  if (raw.incorrect_answers.length !== 3) return null;

  const correctDecoded = decodeHtml(raw.correct_answer);
  const incorrectDecoded = raw.incorrect_answers.map(decodeHtml);
  const questionDecoded = decodeHtml(raw.question);

  const allOptions = [correctDecoded, ...incorrectDecoded];
  const { shuffled, originalIndices } = shuffleArray(allOptions);
  const correctIndexAfterShuffle = originalIndices.indexOf(0);

  return {
    question: questionDecoded,
    options: shuffled,
    correctIndex: correctIndexAfterShuffle,
    explanation: `The correct answer is: ${correctDecoded}`,
    difficulty: raw.difficulty,
  };
}

// ---------------------------------------------------------------------------
// Category map — each entry has:
//   id        : opentdb category ID
//   broad     : keywords that ARE the category (opentdb is a good match)
//   specific  : keywords that are SUB-TOPICS (opentdb would be off-topic)
// ---------------------------------------------------------------------------

interface CategoryEntry {
  id: number;
  broad: RegExp;
  specific: RegExp | null;
}

const CATEGORY_ENTRIES: CategoryEntry[] = [
  {
    id: 9,
    broad: /^(general knowledge|trivia|mixed|general trivia)$/i,
    specific: null,
  },
  {
    id: 10,
    broad: /\b(books?|literature|novels?|fiction)\b/i,
    specific: /\b(harry potter|lord of the rings|1984|shakespeare|dickens|tolkien|agatha christie|stephen king)\b/i,
  },
  {
    id: 11,
    broad: /\b(films?|movies?|cinema|hollywood)\b/i,
    specific: /\b(marvel|star wars|james bond|disney|pixar|horror movies|action movies|[0-9]{4}s? films?)\b/i,
  },
  {
    id: 12,
    broad: /\b(music|songs?|bands?|albums?|artists?)\b/i,
    specific: /\b(rock music|jazz|classical music|hip hop|pop music|[0-9]{4}s? music|beatles|elvis|taylor swift|michael jackson)\b/i,
  },
  {
    id: 14,
    broad: /\b(television|tv shows?|sitcoms?|series)\b/i,
    specific: /\b(breaking bad|game of thrones|friends|the office|netflix|[0-9]{4}s? tv)\b/i,
  },
  {
    id: 15,
    broad: /\b(video games?|gaming)\b/i,
    specific: /\b(call of duty|minecraft|fortnite|pokemon|zelda|mario|playstation|xbox|[0-9]{4}s? games?|indie games?)\b/i,
  },
  {
    id: 17,
    broad: /\b(science|nature|biology|chemistry|physics)\b/i,
    specific: /\b(quantum|evolution|genetics|astronomy|space|climate|neuroscience|organic chemistry)\b/i,
  },
  {
    id: 18,
    broad: /\b(computers?|programming|software|internet|technology|tech)\b/i,
    specific: /\b(javascript|python|linux|cybersecurity|ai |machine learning|blockchain|[0-9]{4}s? tech)\b/i,
  },
  {
    id: 19,
    broad: /\b(math|mathematics|algebra|geometry|calculus|arithmetic)\b/i,
    specific: null,
  },
  {
    id: 20,
    broad: /\b(mythology|myths?|legends?)\b/i,
    specific: /\b(norse|greek|roman|egyptian|celtic|hindu|aztec|japanese mythology)\b/i,
  },
  {
    id: 21,
    broad: /\b(sports?)\b/i,
    // Any sport + time period or specific team/league = too specific for opentdb
    specific: /\b(nba|nfl|nhl|mlb|premier league|la liga|champions league|olympics|[0-9]{4}s?\s*(nba|nfl|sports?)|world cup [0-9]{4}|specific team)\b/i,
  },
  {
    id: 22,
    broad: /\b(geography|countries|capitals|continents)\b/i,
    specific: /\b(european|asian|african|american|south american|oceanian|middle eastern)\b/i,
  },
  {
    id: 23,
    broad: /\b(history|historical)\b/i,
    // Any specific war, era, empire, decade, country's history = too specific
    specific: /\b(ww2|wwii|world war|cold war|vietnam|roman empire|ancient|medieval|renaissance|industrial revolution|civil war|napoleon|[0-9]{4}s?\s*history|american history|british history|french revolution|greek history)\b/i,
  },
  {
    id: 24,
    broad: /\b(politics|government|elections?|democracy)\b/i,
    specific: /\b(american politics|us politics|british politics|republican|democrat|specific country)\b/i,
  },
  {
    id: 27,
    broad: /\b(animals?|wildlife|mammals?|birds?|fish|insects?|reptiles?)\b/i,
    specific: /\b(marine|ocean|african|endangered|prehistoric|dinosaurs?)\b/i,
  },
];

export interface OpentdbSuitability {
  /** Whether opentdb is a good match for this topic */
  suitable: boolean;
  /** opentdb category ID to use, or null */
  categoryId: number | null;
  /** Reason, for logging */
  reason: string;
}

/**
 * Determine whether opentdb is a good source for this topic.
 * Returns suitable=false for sub-topics that would yield off-topic questions.
 */
export function assessOpentdbSuitability(topic: string): OpentdbSuitability {
  const normalized = topic.trim();

  for (const entry of CATEGORY_ENTRIES) {
    if (entry.broad.test(normalized)) {
      // Topic matches this category's broad keywords
      if (entry.specific && entry.specific.test(normalized)) {
        // But it's a sub-topic — opentdb would be too broad
        return {
          suitable: false,
          categoryId: null,
          reason: `"${topic}" is a sub-topic; opentdb category would include off-topic questions`,
        };
      }
      // Good match — topic IS the category
      return {
        suitable: true,
        categoryId: entry.id,
        reason: `"${topic}" matches opentdb category ${entry.id}`,
      };
    }
  }

  // No category match at all — opentdb would return completely random questions
  return {
    suitable: false,
    categoryId: null,
    reason: `"${topic}" has no matching opentdb category`,
  };
}

/**
 * Fetch verified questions from opentdb.
 * Caller should check assessOpentdbSuitability() first.
 */
export async function fetchFromOpentdb(
  categoryId: number,
  count: number,
  difficulty: "easy" | "medium" | "hard" | "random" = "random",
): Promise<TriviaQuestion[]> {
  const difficultyParam =
    difficulty === "random" ? "" : `&difficulty=${difficulty}`;
  const requestCount = Math.min(50, count + 5);

  const url = `${OPENTDB_BASE}?amount=${requestCount}&type=multiple&category=${categoryId}${difficultyParam}`;

  let resp: Response;
  try {
    resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch (err) {
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

  if (data.response_code !== 0 || !Array.isArray(data.results)) {
    console.info("[opentdb] no results (code", data.response_code, ")");
    return [];
  }

  return data.results
    .map(convertQuestion)
    .filter((q): q is TriviaQuestion => q !== null)
    .slice(0, count);
}
