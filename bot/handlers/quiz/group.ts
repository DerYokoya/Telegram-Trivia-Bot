import { Context, Markup } from "telegraf";
import type { GroupQuizSession } from "./../../groupquiz";
import { buildQuestionText } from "../../messages";
import { buildAnswerKeyboard } from "../../keyboards";
import { escapeHtml, chunkText, formatDuration, medal } from "../../utils";
import { LETTERS } from "../../../constants";
import { getStandings } from "./../../groupquiz";
import { recordResult } from "./../../leaderboard";
import { recordGroupQuizParticipation, renderNewAchievements } from "./../../achievements";
import { addToLifetimeStats } from "./../../lifetimeStats";
import { calculateWeightedScore } from "./../../scoring";

export async function sendNextGroupQuestion(ctx: Context, session: GroupQuizSession) {
  const q = session.questions[session.currentIndex];
  if (!q) {
    await finishGroupQuiz(ctx, session);
    return;
  }

  session.results[session.currentIndex] = {
    questionIndex: session.currentIndex,
    winnerId: null,
    winnerName: null,
    winnerElapsedMs: null,
    correctIndex: q.correctIndex,
    allAnswers: new Map(),
  };

  session.questionStartedAt = Date.now();
  const text = buildQuestionText(session.questions, session.currentIndex);
  const sent = await ctx.reply(text, {
    parse_mode: "HTML",
    ...buildAnswerKeyboard(session.currentIndex, "gans"),
  });
  session.activeMessageId = sent.message_id;
  session.lastAnswerAttempt.clear();
}

export async function finishGroupQuiz(ctx: Context, session: GroupQuizSession) {
  session.phase = "finished";

  const standings = getStandings(session);
  const total = session.questions.length;

  const lines: string[] = [];
  lines.push(`🏆 <b>Quiz Over — ${escapeHtml(session.topic ?? "Trivia")}</b>`);
  lines.push("");

  if (standings.length === 0) {
    lines.push("Nobody answered. Better luck next time!");
  } else {
    const topCorrect = standings[0]!.correct;
    const topAvg =
      standings[0]!.correct > 0
        ? standings[0]!.totalCorrectMs / standings[0]!.correct
        : Infinity;

    lines.push("<b>Final Standings:</b>");
    lines.push("");

    let rank = 1;
    for (let i = 0; i < standings.length; i++) {
      const p = standings[i]!;
      const prev = standings[i - 1];
      if (
        prev &&
        (p.correct !== prev.correct ||
          p.totalCorrectMs / Math.max(p.correct, 1) !==
            prev.totalCorrectMs / Math.max(prev.correct, 1))
      ) {
        rank = i + 1;
      }
      const avgMs = p.correct > 0 ? p.totalCorrectMs / p.correct : 0;
      const pct = total > 0 ? Math.round((p.correct / total) * 100) : 0;

      // Calculate weighted score for display (optional)
      const weightedScore = calculateWeightedScore({
        correct: p.correct,
        total: total,
        avgSpeedMs: avgMs,
        difficulty: session.difficulty,
        questionDifficulties: session.questionDifficulties,
      });

      lines.push(
        `${medal(rank)} <b>${escapeHtml(p.displayName)}</b>` +
          `  ✅ ${p.correct}/${total} (${pct}%)` +
          (p.correct > 0 ? `  ⚡ avg ${formatDuration(avgMs)}` : "") +
          `  🏆 ${weightedScore} pts`,
      );
    }

    lines.push("");
    const winners = standings.filter(
      (p) =>
        p.correct === topCorrect &&
        (topCorrect === 0 || p.totalCorrectMs / p.correct === topAvg),
    );

    if (winners.length === 1) {
      lines.push(`🎉 Winner: <b>${escapeHtml(winners[0]!.displayName)}</b>!`);
    } else if (winners.length > 1 && topCorrect > 0) {
      const names = winners.map((w) => escapeHtml(w.displayName)).join(", ");
      lines.push(`🤝 It's a tie between <b>${names}</b>!`);
    }
  }

  lines.push("");
  lines.push("<b>Question-by-question winners:</b>");
  session.results.forEach((r, i) => {
    const q = session.questions[i];
    if (!q) return;
    const correctLetter = LETTERS[r.correctIndex];
    const diffIcons: Record<string, string> = {
      easy: "🟢",
      medium: "🟡",
      hard: "🔴",
    };
    const diffBadge =
      q.difficulty && diffIcons[q.difficulty]
        ? ` ${diffIcons[q.difficulty]}`
        : "";
    if (r.winnerId !== null) {
      lines.push(
        `  Q${i + 1}${diffBadge}: 🏅 <b>${escapeHtml(r.winnerName ?? "")}</b>` +
          ` (${formatDuration(r.winnerElapsedMs ?? 0)})` +
          ` — Answer: <b>${correctLetter}</b>`,
      );
    } else {
      lines.push(
        `  Q${i + 1}${diffBadge}: No correct answer — Answer: <b>${correctLetter}</b>`,
      );
    }
    if (q.explanation) lines.push(`       <i>${escapeHtml(q.explanation)}</i>`);
  });

  lines.push("");
  lines.push("Send /gquiz to play again!");

  for (const chunk of chunkText(lines.join("\n"), 3500)) {
    await ctx.reply(chunk, { parse_mode: "HTML" });
  }

  // Determine winner userId for achievement purposes
  const winnerIds = new Set<number>();
  if (standings.length > 0) {
    const topCorrect = standings[0]!.correct;
    const topAvg =
      standings[0]!.correct > 0
        ? standings[0]!.totalCorrectMs / standings[0]!.correct
        : Infinity;
    for (const p of standings) {
      if (
        p.correct === topCorrect &&
        (topCorrect === 0 || p.totalCorrectMs / p.correct === topAvg)
      ) {
        winnerIds.add(p.userId);
      } else {
        break;
      }
    }
  }

  // Achievements + leaderboard for all participants
  const allNewAchs = new Map<number, string[]>();

  for (const p of standings) {
    if (p.correct === 0) continue;

    const avgSpeedMs = p.correct > 0 ? p.totalCorrectMs / p.correct : 0;
    const isWinner = winnerIds.has(p.userId);

    const newAchs = await recordGroupQuizParticipation(
      p.userId,
      isWinner,
      p.correct,
      total,
      avgSpeedMs,
    );

    if (newAchs.length > 0) allNewAchs.set(p.userId, newAchs);

    await addToLifetimeStats(p.userId, p.correct, total);

    recordResult({
      userId: p.userId,
      nickname: p.displayName,
      topic: session.topic ?? "Trivia",
      category: (session.topic ?? "trivia").toLowerCase().trim(),
      difficulty: session.difficulty,
      correct: p.correct,
      total: total,
      avgSpeedMs: avgSpeedMs,
      recordedAt: Date.now(),
    });

    // You'll need to implement or import checkAndAnnounceLeaderboardAchievements
    // await checkAndAnnounceLeaderboardAchievements(ctx, p.userId);
  }

  // Announce newly unlocked achievements
  if (allNewAchs.size > 0) {
    const achLines: string[] = ["🎉 <b>Achievements unlocked!</b>"];
    for (const [, ids] of allNewAchs) {
      const msg = renderNewAchievements(ids);
      if (msg) achLines.push(msg);
    }
    await ctx.reply(achLines.join("\n"), { parse_mode: "HTML" });
  }
}