import { Context } from "telegraf";
import type { QuizSession } from "./../../quiz";
import { buildQuestionText, renderLeaderboard } from "../../messages";
import { buildAnswerKeyboard } from "../../keyboards";
import { escapeHtml, chunkText, formatDuration } from "../../utils";
import {recordSoloQuizComplete} from "../../achievements";
import { addToLifetimeStats } from "../../lifetimeStats";
import {renderNewAchievements} from "../../achievements";
import { Markup } from "telegraf";
import { LETTERS } from "../../../constants";

export async function sendNextSoloQuestion(ctx: Context, session: QuizSession) {
  const q = session.questions[session.currentIndex];
  if (!q) {
    await finishSoloQuiz(ctx, session);
    return;
  }
  session.questionStartedAt = Date.now();
  const text = buildQuestionText(session.questions, session.currentIndex);
  const sent = await ctx.reply(text, {
    parse_mode: "HTML",
    ...buildAnswerKeyboard(session.currentIndex, "ans"),
  });
  session.activeMessageId = sent.message_id;
}

export async function finishSoloQuiz(ctx: Context, session: QuizSession) {
  session.phase = "finished";
  const total = session.results.length;
  const correct = session.results.filter((r) => r.isCorrect).length;
  const wrong = total - correct;
  const totalTime = session.quizStartedAt
    ? Date.now() - session.quizStartedAt
    : session.results.reduce((acc, r) => acc + r.timeMs, 0);
  const avg = total > 0 ? totalTime / total : 0;
  const fastest =
    session.results.length > 0
      ? Math.min(...session.results.map((r) => r.timeMs))
      : 0;
  const slowest =
    session.results.length > 0
      ? Math.max(...session.results.map((r) => r.timeMs))
      : 0;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  let verdict = "Keep practicing!";
  if (score === 100) verdict = "Flawless! You crushed it.";
  else if (score >= 80) verdict = "Great job!";
  else if (score >= 60) verdict = "Solid effort.";
  else if (score >= 40) verdict = "Not bad — room to grow.";

  const lines: string[] = [];
  lines.push(`<b>Recap — ${escapeHtml(session.topic ?? "Trivia")}</b>`);
  lines.push("");
  lines.push(`<b>Score:</b> ${correct}/${total} (${score}%)`);
  lines.push(`<b>Correct:</b> ${correct}   <b>Wrong:</b> ${wrong}`);
  lines.push(`<b>Total time:</b> ${formatDuration(totalTime)}`);
  lines.push(`<b>Average per question:</b> ${formatDuration(avg)}`);
  if (total > 0) {
    lines.push(
      `<b>Fastest:</b> ${formatDuration(fastest)}   <b>Slowest:</b> ${formatDuration(slowest)}`,
    );
  }
  lines.push("");
  lines.push(`<i>${verdict}</i>`);
  lines.push("");
  lines.push("<b>Question breakdown:</b>");

  session.results.forEach((r, i) => {
    const mark = r.isCorrect ? "✅" : r.selectedIndex === null ? "⏭️" : "❌";
    const correctLetter = LETTERS[r.correctIndex];
    const yourLetter =
      r.selectedIndex !== null ? LETTERS[r.selectedIndex] : "—";
    const q = session.questions[i];
    const diffIcons: Record<string, string> = {
      easy: "🟢",
      medium: "🟡",
      hard: "🔴",
    };
    const diffBadge =
      q?.difficulty && diffIcons[q.difficulty]
        ? ` ${diffIcons[q.difficulty]}`
        : "";
    lines.push("");
    lines.push(
      `${mark}${diffBadge} <b>Q${i + 1}.</b> ${escapeHtml(r.question)}`,
    );
    lines.push(
      `   Your answer: <b>${yourLetter}</b>   Correct: <b>${correctLetter}</b>   Time: ${formatDuration(r.timeMs)}`,
    );
    const expl = session.questions[i]?.explanation;
    if (expl) lines.push(`   <i>${escapeHtml(expl)}</i>`);
  });

  lines.push("");
  lines.push("Send /quiz to play again.");

  for (const chunk of chunkText(lines.join("\n"), 3500)) {
    await ctx.reply(chunk, { parse_mode: "HTML" });
  }

  // Update lifetime stats
  await addToLifetimeStats(session.chatId, correct, total);

  // Achievements
  const correctResults = session.results.filter((r) => r.isCorrect);
  const avgCorrectSpeedMs =
    correctResults.length > 0
      ? correctResults.reduce((s, r) => s + r.timeMs, 0) / correctResults.length
      : avg;
  const newAchs = await recordSoloQuizComplete(
    session.chatId,
    correct,
    total,
    avg,
  );
  const achMsg = renderNewAchievements(newAchs);
  if (achMsg) await ctx.reply(achMsg, { parse_mode: "HTML" });

  // Prompt nickname for leaderboard
  session.phase = "awaiting_nickname";
  await ctx.reply(
    "🏆 <b>Want to save your result to the leaderboard?</b>\n\n" +
      "Reply with a nickname (up to 24 chars), or /skip to skip.",
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        Markup.button.callback("⏭ Skip", "skip_nickname"),
      ]),
    },
  );
}