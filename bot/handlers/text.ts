import { Context } from "telegraf";
import { getSession, resetSession } from "./../quiz";
import { getGroupSession } from "./../groupquiz";
import { getCategoryLeaderboard, recordResult } from "./../leaderboard";
import { renderLeaderboard } from "../messages";
import { isGroupChat, escapeHtml, checkAndAnnounceLeaderboardAchievements } from "../utils";
import { buildCountKeyboard, buildDifficultyKeyboard } from "../keyboards";

export function registerTextHandler(bot: any) {
  bot.on("text", async (ctx: Context) => {
    // Since we're using the "text" event, we can safely assert the type
    const message = ctx.message as { text: string };
    
    if (!message || !message.text) return;
    
    const text = message.text.trim();

    if (!text) return;
    if (text.startsWith("/")) return;

    const chatId = ctx.chat?.id;
    if (typeof chatId !== "number") return;
    const from = (ctx as any).from;

    // Group chat text flow
    if (isGroupChat(ctx)) {
      if (!from) return;
      const session = getGroupSession(chatId, from.id);

      if (session.phase === "awaiting_topic") {
        if (text.length < 2 || text.length > 120) {
          await ctx.reply("Please enter a topic between 2 and 120 characters.");
          return;
        }
        session.topic = text;
        session.phase = "awaiting_count";
        await ctx.reply(
          `Topic: <b>${escapeHtml(text)}</b>\n\nHow many questions?`,
          { parse_mode: "HTML", ...buildCountKeyboard("gcount") },
        );
      }
      return;
    }

    // Solo chat text flow
    const session = getSession(chatId);

    if (session.phase === "awaiting_leaderboard_category") {
      if (text.length < 1 || text.length > 60) {
        await ctx.reply("Please enter a category name (1–60 chars).");
        return;
      }
      session.phase = "idle";
      const entries = getCategoryLeaderboard(text, 10);
      await ctx.reply(
        renderLeaderboard(entries, `📊 Leaderboard — "${text}"`),
        { parse_mode: "HTML" },
      );
      return;
    }

    if (session.phase === "awaiting_nickname") {
      if (text.length < 1 || text.length > 24) {
        await ctx.reply(
          "Nickname must be between 1 and 24 characters. Try again, or press Skip.",
        );
        return;
      }
      session.nickname = text;
      const total = session.results.length;
      const correct = session.results.filter((r) => r.isCorrect).length;
      const correctResults = session.results.filter((r) => r.isCorrect);
      const avgSpeedMs =
        correctResults.length > 0
          ? correctResults.reduce((s, r) => s + r.timeMs, 0) /
            correctResults.length
          : 0;

      recordResult({
        userId: chatId,
        nickname: text,
        topic: session.topic ?? "Trivia",
        category: (session.topic ?? "trivia").toLowerCase().trim(),
        difficulty: session.difficulty,
        correct,
        total,
        avgSpeedMs,
        recordedAt: Date.now(),
      });

      await checkAndAnnounceLeaderboardAchievements(ctx, chatId);

      session.phase = "idle";
      await ctx.reply(
        `✅ Saved as <b>${escapeHtml(text)}</b>!\n\n` +
          "Check /leaderboard or /topleaderboard to see where you stand.",
        { parse_mode: "HTML" },
      );
      return;
    }

    if (session.phase === "awaiting_topic") {
      if (text.length < 2 || text.length > 120) {
        await ctx.reply("Please enter a topic between 2 and 120 characters.");
        return;
      }
      session.topic = text;
      session.phase = "awaiting_count";
      await ctx.reply(
        `Topic: <b>${escapeHtml(text)}</b>\n\nHow many questions?`,
        { parse_mode: "HTML", ...buildCountKeyboard("count") },
      );
      return;
    }

    if (session.phase === "in_progress") {
      await ctx.reply("Tap one of the answer buttons, or /cancel to stop.");
      return;
    }

    if (session.phase === "idle" || session.phase === "finished") {
      await ctx.reply("Send /quiz to start a new trivia round.");
    }
  });
}