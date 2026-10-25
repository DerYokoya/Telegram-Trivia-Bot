const GROQ_API_KEY = process.env["GROQ_API_KEY"]?.trim();
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const MODEL = process.env["GROQ_MODEL"] ?? "openai/gpt-oss-120b";

export type QuestionDifficulty = "easy" | "medium" | "hard";

// groq.ts - AI question generation via the Groq API
export interface TriviaQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  /** Present only when difficulty is "random" or a fixed difficulty was requested */
  difficulty?: "easy" | "medium" | "hard";
}

export async function generateTriviaQuestions(
  topic: string,
  count: number,
  difficulty: "easy" | "medium" | "hard" | "random" = "random",
): Promise<TriviaQuestion[]> {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY environment variable is required but was not provided.",
    );
  }

  const isRandom = difficulty === "random";

  const difficultyInstruction = isRandom
    ? `Vary the difficulty — include a mix of easy, medium, and hard questions. For each question include a "difficulty" field set to exactly one of: "easy", "medium", or "hard".`
    : `All questions must be at ${difficulty} difficulty. For each question include a "difficulty" field set to "${difficulty}".`;

  const prompt = `Create exactly ${count} multiple-choice trivia questions specifically about "${topic}".
${difficultyInstruction}

TOPIC RELEVANCE — most important rule:
- Every single question MUST be directly about "${topic}". No exceptions.
- Do NOT include tangentially related questions (e.g. for "WWII" do not ask about WWI, the Roman Empire, or unrelated history).
- Do NOT include general trivia questions just because you ran out of topic-specific ideas — generate fewer questions instead if needed.
- If you cannot generate ${count} on-topic questions, generate as many as you can (minimum 1).

ACCURACY RULES:
- Only include facts you are certain are correct. Skip any question you are unsure about.
- Do NOT invent statistics, dates, or records you cannot verify with high confidence.
- Each question must have EXACTLY ONE clearly correct answer and 3 clearly wrong options.
- Wrong options must be plausible but unambiguously incorrect.
- Avoid questions about events after 2023 where your knowledge may be incomplete.
- Keep questions concise (under 200 chars). Keep options under 80 chars each.
- Provide a one-sentence explanation naming the correct answer and briefly explaining why.

Respond ONLY with valid JSON in this exact shape, no markdown fences, no commentary:
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctIndex": 0,
      "explanation": "string",
      "difficulty": "easy"
    }
  ]
}`;

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a trivia question generator. Always respond with valid JSON only, no markdown fences, no commentary.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Groq API error", {
      status: response.status,
      errorText,
    });
    throw new Error(`Groq API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  let content = data.choices?.[0]?.message?.content ?? "";
  if (!content) {
    throw new Error("Empty response from question generator.");
  }

  content = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: { questions?: TriviaQuestion[] };
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error("Failed to parse questions JSON", { err, content });
    throw new Error("Failed to parse questions from AI response.");
  }

  const questions = parsed.questions ?? [];
  const valid = questions.filter(
    (q) =>
      q &&
      typeof q.question === "string" &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      typeof q.correctIndex === "number" &&
      q.correctIndex >= 0 &&
      q.correctIndex < 4,
  );

  if (valid.length === 0) {
    throw new Error("No valid questions returned by AI.");
  }

  // Normalise difficulty field
  const validDifficulties = new Set<string>(["easy", "medium", "hard"]);
  for (const q of valid) {
    // If a fixed difficulty was set, always stamp it
    if (!isRandom && !q.difficulty) {
      q.difficulty = difficulty as "easy" | "medium" | "hard";
    }
  }
  return valid.slice(0, count);
}
