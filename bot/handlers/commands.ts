import { Context, Markup } from "telegraf";
import { resetSession, getSession } from "./../quiz";
import { resetGroupSession, getGroupSession } from "./../groupquiz";
import { getGlobalLeaderboard, getCategoryLeaderboard } from "./../leaderboard";
import { renderAchievements } from "./../achievements";
import { getLifetimeStats } from "./../lifetimeStats";
import { renderLeaderboard } from "../messages";
import { isGroupChat, escapeHtml, getSenderName, chunkText } from "../utils";
import { checkRateLimit, isRateLimited, recordQuizRequest, getCooldownRemainingMs, getRequesterId } from "../rate-limit";

export function registerCommands(bot: any) {
  bot.start(async (ctx: Context) => {
    if (!ctx.chat) {
      await ctx.reply("Error: Chat not found.");
      return;
    }
    resetSession(ctx.chat.id);
    await ctx.reply(
      "Welcome to Trivia Bot! 🎉\n\n" +
        "AI-powered trivia on any topic.\n\n" +
        "<b>Solo:</b> /quiz\n" +
        "<b>Group competition:</b> /gquiz  (use in a group chat)\n\n" +
        "Other commands:\n" +
        "/achievements — your achievement badges\n" +
        "/leaderboard — global leaderboard\n" +
        "/topleaderboard — leaderboard by topic/category\n" +
        "/stats — your personal stats\n" +
        "/cancel — stop current quiz\n" +
        "/help — detailed help",
      { parse_mode: "HTML" },
    );
  });

  bot.help(async (ctx: Context) => {
    await ctx.reply(
      "<b>Solo (/quiz)</b>\n" +
        "1. Send /quiz\n" +
        "2. Enter a topic\n" +
        "3. Choose question count\n" +
        "4. Choose difficulty (Easy / Medium / Hard / Random)\n" +
        "5. Tap your answer\n" +
        "6. Get a full recap + option to save to leaderboard\n\n" +
        "<b>Group (/gquiz)</b> — use in a group/supergroup\n" +
        "1. Send /gquiz\n" +
        "2. Anyone (or the host) enters the topic\n" +
        "3. Choose question count & difficulty\n" +
        "4. First correct tap wins each question\n" +
        "5. Leaderboard shown at the end\n\n" +
        "<b>Difficulty</b>\n" +
        "🟢 Easy  🟡 Medium  🔴 Hard  🎲 Random (AI assigns per question)\n\n" +
        "<b>Achievements</b>\n" +
        "/achievements — see all your unlocked badges\n\n" +
        "<b>Leaderboards</b>\n" +
        "/leaderboard — top 10 all-time across all topics\n" +
        "/topleaderboard — top 10 for a specific category\n\n" +
        "Use /cancel anytime to stop.",
      { parse_mode: "HTML" },
    );
  });

  bot.command("cancel", async (ctx: Context) => {
    if (!ctx.chat) {
      await ctx.reply("Error: Chat not found.");
      return;
    }
    
    if (isGroupChat(ctx)) {
      const from = (ctx as any).from;
      if (!from) return;
      const session = getGroupSession(ctx.chat.id, from.id);
      if (session.phase === "idle") {
        await ctx.reply("No group quiz running. Use /gquiz to start one.");
        return;
      }
      if (session.hostId !== from.id) {
        await ctx.reply("Only the quiz host can cancel the quiz.");
        return;
      }
      resetGroupSession(ctx.chat.id, from.id);
      await ctx.reply("Group quiz cancelled.");
    } else {
      const session = getSession(ctx.chat.id);
      if (session.phase === "idle") {
        await ctx.reply("Nothing to cancel. Send /quiz to start.");
        return;
      }
      resetSession(ctx.chat.id);
      await ctx.reply("Quiz cancelled. Send /quiz to start a new one.");
    }
  });

  bot.command("achievements", async (ctx: Context) => {
    if (!ctx.chat) {
      await ctx.reply("Error: Chat not found.");
      return;
    }
    
    const userId = isGroupChat(ctx)
      ? ((ctx as any).from?.id ?? ctx.chat.id)
      : ctx.chat.id;
    const text = await renderAchievements(userId);
    for (const chunk of chunkText(text, 3500)) {
      await ctx.reply(chunk, { parse_mode: "HTML" });
    }
  });

  bot.command("quiz", async (ctx: Context) => {
    if (!ctx.chat) {
      await ctx.reply("Error: Chat not found.");
      return;
    }
    
    const requesterId = getRequesterId(ctx);
    if (requesterId === null) {
      await ctx.reply("Unable to identify you. Please try again.");
      return;
    }
    if (isRateLimited(requesterId)) {
      const secondsLeft = Math.ceil(getCooldownRemainingMs(requesterId) / 1000);
      await ctx.reply(
        `⏳ Slow down a bit — please wait ${secondsLeft}s before starting another quiz.`,
      );
      return;
    }
    recordQuizRequest(requesterId);

    if (isGroupChat(ctx)) {
      await ctx.reply("For group competitions use /gquiz in this chat!");
      return;
    }
    const session = resetSession(ctx.chat.id);
    session.phase = "awaiting_topic";
    await ctx.reply(
      "What topic do you want to be quizzed on?\n\n" +
        "Examples:\n" +
        "• <i>General Knowledge</i>\n" +
        "• <i>Trivia</i>\n" +
        "• <i>Books</i> · <i>Literature</i>\n" +
        "• <i>Films</i> · <i>Movies</i>\n" +
        "• <i>Music</i> · <i>Television</i>\n" +
        "• <i>Video Games</i> · <i>Gaming</i>\n" +
        "• <i>Science</i> · <i>Nature</i>\n" +
        "• <i>Biology</i> · <i>Chemistry</i> · <i>Physics</i>\n" +
        "• <i>Technology</i> · <i>Computers</i> · <i>Programming</i>\n" +
        "• <i>Math</i> · <i>Mathematics</i> · <i>Algebra</i> · <i>Geometry</i>\n" +
        "• <i>Mythology</i> · <i>Sports</i>\n" +
        "• <i>Geography</i> · <i>Countries</i>\n" +
        "• <i>History</i> · <i>Politics</i> · <i>Government</i>\n" +
        "• <i>Animals</i> · <i>Wildlife</i>",
      { parse_mode: "HTML" },
    );
  });

  bot.command("gquiz", async (ctx: Context) => {
    if (!ctx.chat) {
      await ctx.reply("Error: Chat not found.");
      return;
    }
    
    const from = (ctx as any).from;
    if (!from) return;

    if (!isGroupChat(ctx)) {
      await ctx.reply(
        "Group quizzes only work in group/supergroup chats.\n" +
          "Use /quiz here for a solo game!",
      );
      return;
    }

    const chatId = ctx.chat.id;
    if (isRateLimited(chatId)) {
      const secondsLeft = Math.ceil(getCooldownRemainingMs(chatId) / 1000);
      await ctx.reply(
        `⏳ This chat needs a short break. Please wait ${secondsLeft}s before starting another group quiz.`,
      );
      return;
    }

    const existing = getGroupSession(chatId, from.id);
    if (existing.phase !== "idle" && existing.phase !== "finished") {
      await ctx.reply(
        "A quiz is already running! Use /cancel to stop it first.",
      );
      return;
    }

    recordQuizRequest(chatId);
    const session = resetGroupSession(chatId, from.id);
    session.phase = "awaiting_topic";

    await ctx.reply(
      `🎮 <b>Group Quiz started by ${escapeHtml(getSenderName(ctx))}!</b>\n\n` +
        "What topic should the quiz be on?\n" +
        "<i>Anyone in the chat can type the topic.</i>",
      { parse_mode: "HTML" },
    );
  });

  bot.command("skip", async (ctx: Context) => {
    if (!ctx.chat) {
      await ctx.reply("Error: Chat not found.");
      return;
    }
    
    if (isGroupChat(ctx)) return;
    const session = getSession(ctx.chat.id);
    if (session.phase === "awaiting_nickname") {
      session.phase = "idle";
      await ctx.reply("Skipped. Send /quiz to play again.");
    }
  });

  bot.command("leaderboard", async (ctx: Context) => {
    const entries = getGlobalLeaderboard(10);
    const text = renderLeaderboard(
      entries,
      "🌍 Global Leaderboard — All Topics",
    );
    await ctx.reply(text, { parse_mode: "HTML" });
  });

  bot.command("topleaderboard", async (ctx: Context) => {
    if (!ctx.chat) {
      await ctx.reply("Error: Chat not found.");
      return;
    }
    
    const args = (ctx.message as any)?.text
      ?.split(/\s+/)
      .slice(1)
      .join(" ")
      .trim();
    if (args && args.length > 0) {
      const entries = getCategoryLeaderboard(args, 10);
      await ctx.reply(
        renderLeaderboard(entries, `📊 Leaderboard — "${args}"`),
        { parse_mode: "HTML" },
      );
    } else {
      const session = getSession(ctx.chat.id);
      session.phase = "awaiting_leaderboard_category";
      await ctx.reply(
        "Which topic/category leaderboard do you want to see?\n\n" +
          "Examples: <i>science</i>, <i>history</i>, <i>sports</i>",
        { parse_mode: "HTML" },
      );
    }
  });

  bot.command("stats", async (ctx: Context) => {
    if (!ctx.chat) {
      await ctx.reply("Error: Chat not found.");
      return;
    }
    
    const stats = await getLifetimeStats(ctx.chat.id);
    if (!stats || stats.total === 0) {
      await ctx.reply("No stats yet — play a quiz first using /quiz!");
      return;
    }
    const score = Math.round((stats.correct / stats.total) * 100);
    await ctx.reply(
      `<b>Your Lifetime Stats</b>\n\n` +
        `<b>Total questions:</b> ${stats.total}\n` +
        `<b>Correct:</b> ${stats.correct}\n` +
        `<b>Score:</b> ${score}%`,
      { parse_mode: "HTML" },
    );
  });

  bot.command("about", async (ctx: Context) => {
    await ctx.reply(
      "🤖 <b>Trivia Bot</b>\n" +
        "AI-generated trivia on any topic.\n\n" +
        "Built with Telegraf + Groq.\n" +
        "by DerYokoya.\n\n" +
        "Send /quiz to begin!",
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          Markup.button.url("🌐 GitHub", "https://github.com/DerYokoya"),
        ]),
      },
    );
  });

  bot.command("scoring", async (ctx: Context) => {
    await ctx.reply(
      `<b>📊 How Scoring Works</b>\n\n` +
        `<b>Base Score:</b> Accuracy × 1000 points\n\n` +
        `<b>Difficulty Multipliers:</b>\n` +
        `🟢 Easy: 1.0x\n` +
        `🟡 Medium: 1.5x\n` +
        `🔴 Hard: 2.0x\n` +
        `🎲 Random: Weighted average of actual questions\n` +
        `   (Example: 3 easy + 2 hard = 1.4x)\n\n` +
        `<b>Speed Bonuses:</b>\n` +
        `⚡ &lt;5s avg: +30%\n` +
        `🚀 &lt;10s avg: +15%\n` +
        `🏃 &lt;20s avg: +5%\n\n` +
        `<b>Perfect Score:</b> +10% bonus\n\n` +
        `<b>Final Score:</b> Base × Difficulty × Speed × Perfect`,
      { parse_mode: "HTML" },
    );
  });
}