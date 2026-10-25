// webhook.ts
import { Telegraf } from "telegraf";
import { initLeaderboardStore } from "./bot/leaderboard";
import { registerCommands } from "./bot/handlers/commands";
import { registerActions } from "./bot/handlers/actions";
import { registerTextHandler } from "./bot/handlers/text";

export async function setupWebhook(): Promise<Telegraf | undefined> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN not set; Telegram bot disabled.");
    return;
  }

  await initLeaderboardStore();

  const bot = new Telegraf(token);

  // Set bot commands
  await bot.telegram.setMyCommands([
    { command: "quiz", description: "Start a solo trivia quiz" },
    { command: "gquiz", description: "Start a group trivia quiz" },
    { command: "cancel", description: "Cancel the current quiz" },
    { command: "achievements", description: "View your achievements" },
    { command: "leaderboard", description: "Global all-topics leaderboard" },
    { command: "topleaderboard", description: "Leaderboard for a topic" },
    { command: "stats", description: "Your personal quiz stats" },
    { command: "scoring", description: "How scoring works" },
    { command: "help", description: "Show help information" },
    { command: "about", description: "About this bot" },
  ]);

  // Register all handlers
  registerCommands(bot);
  registerActions(bot);
  registerTextHandler(bot);

  // Error handler
  bot.catch(async (err, ctx) => {
    console.error("Telegraf error:", err, (ctx as any).update);
    try {
      await ctx.reply(
        "Sorry, something went wrong. Please try again or type /help for guidance.",
      );
    } catch {
      // ignore reply failures
    }
  });

  return bot;
}