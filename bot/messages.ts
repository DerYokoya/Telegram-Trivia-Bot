import { escapeHtml, medal, formatDuration } from "./utils";
import type { LeaderboardEntry } from "./leaderboard";
import { LETTERS } from "../constants";

export function buildQuestionText(
  questions: { question: string; options: string[]; difficulty?: string }[],
  idx: number,
): string {
  const total = questions.length;
  const q = questions[idx];
  if (!q) return "";
  const header = `<b>Question ${idx + 1} of ${total}</b>`;
  const diffIcons: Record<string, string> = {
    easy: "🟢",
    medium: "🟡",
    hard: "🔴",
  };
  const diffBadge =
    q.difficulty && diffIcons[q.difficulty]
      ? ` ${diffIcons[q.difficulty]} <i>${q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1)}</i>`
      : "";
  const body = escapeHtml(q.question);
  const options = q.options
    .map((opt, i) => `<b>${LETTERS[i]}.</b> ${escapeHtml(opt)}`)
    .join("\n");
  return `${header}${diffBadge}\n\n${body}\n\n${options}`;
}

export function renderLeaderboard(entries: LeaderboardEntry[], title: string): string {
  if (entries.length === 0) {
    return `<b>${escapeHtml(title)}</b>\n\nNo entries yet. Play a quiz to be the first!`;
  }

  const diffIcon: Record<string, string> = {
    easy: "🟢",
    medium: "🟡",
    hard: "🔴",
    random: "🎲",
  };

  const rows = entries.map((e, i) => {
    const pct = e.total > 0 ? Math.round((e.correct / e.total) * 100) : 0;
    const speed = formatDuration(e.avgSpeedMs);
    const diff = e.difficulty
      ? ` ${diffIcon[e.difficulty] ?? ""} <i>${e.difficulty}</i>`
      : "";
    return (
      `${medal(i + 1)} <b>${escapeHtml(e.nickname)}</b>\n` +
      `   📚 ${escapeHtml(e.topic)}${diff}  ·  ✅ ${e.correct}/${e.total} (${pct}%)  ·  ⚡ avg ${speed}`
    );
  });

  return `<b>${escapeHtml(title)}</b>\n\n${rows.join("\n\n")}`;
}