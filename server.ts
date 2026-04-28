import { startTelegramBot } from "./bot/index";

// Start the Telegram bot directly — no Express server needed
// for a pure polling Telegram bot.
startTelegramBot();
