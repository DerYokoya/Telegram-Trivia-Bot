import { startTelegramBot } from "./bot/index";
import http from "http";

(async () => {
  // Start the Telegram bot
  await startTelegramBot();
  console.log("Telegram bot started");

  // Minimal HTTP server for Back4App health checks
  const PORT = process.env.PORT || 3000;

  http
    .createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Bot is running");
    })
    .listen(PORT, () => {
      console.log(`Health check server running on port ${PORT}`);
    });
})();
