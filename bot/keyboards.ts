import { Markup } from "telegraf";

const COUNT_OPTIONS = [5, 10, 15, 20];
const DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard", "Random"] as const;
const LETTERS = ["A", "B", "C", "D"];

export function buildAnswerKeyboard(questionIndex: number, prefix: "ans" | "gans") {
  return Markup.inlineKeyboard(
    LETTERS.map((letter, i) =>
      Markup.button.callback(letter, `${prefix}:${questionIndex}:${i}`),
    ),
    { columns: 4 },
  );
}

export function buildCountKeyboard(prefix: "count" | "gcount") {
  return Markup.inlineKeyboard(
    COUNT_OPTIONS.map((n) =>
      Markup.button.callback(String(n), `${prefix}:${n}`),
    ),
    { columns: 4 },
  );
}

export function buildDifficultyKeyboard(prefix: "diff" | "gdiff") {
  return Markup.inlineKeyboard(
    DIFFICULTY_OPTIONS.map((d) =>
      Markup.button.callback(d, `${prefix}:${d.toLowerCase()}`),
    ),
    { columns: 2 },
  );
}