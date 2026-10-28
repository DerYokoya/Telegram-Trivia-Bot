// server.ts
import http from "http";
import { setupWebhook } from "./webhook";
import { healthCheck } from "./bot/health";
import { pool } from "./bot/db";

const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = "/webhook";

async function startServer() {
  const bot = await setupWebhook();
  const webhookBaseUrl = process.env.WEBHOOK_URL?.trim().replace(/\/+$/, "");
  const webhookUrl = webhookBaseUrl
    ? `${webhookBaseUrl}${WEBHOOK_PATH}`
    : undefined;
  
  if (!bot) {
    console.error("Failed to setup bot");
    process.exit(1);
  }

  // Create webhook endpoint
  const server = http.createServer(async (req, res) => {
    // Health check endpoint
    if (req.url === "/health") {
      const health = await healthCheck();
      res.writeHead(health.status === "healthy" ? 200 : 503, { 
        "Content-Type": "application/json" 
      });
      res.end(JSON.stringify(health));
      return;
    }

    // Webhook endpoint
    if (req.url === WEBHOOK_PATH && req.method === "POST") {
      try {
        let body = "";
        req.on("data", (chunk) => { body += chunk.toString(); });
        req.on("end", async () => {
          try {
            // Parse the update
            const update = JSON.parse(body);
            await bot.handleUpdate(update);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch (error) {
            console.error("Error handling update:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: String(error) }));
          }
        });
      } catch (error) {
        console.error("Error processing request:", error);
        res.writeHead(500);
        res.end();
      }
      return;
    }

    // Root endpoint
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Telegram Trivia Bot is running!");
  });

  server.listen(PORT, async () => {
    console.log(`✅ Server running on port ${PORT}`);

    if (webhookUrl) {
      console.log(`🔄 Webhook endpoint: ${WEBHOOK_PATH}`);
      try {
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`✅ Webhook set to: ${webhookUrl}`);
        
        // Test webhook
        const info = await bot.telegram.getWebhookInfo();
        console.log("📡 Webhook info:", info);
      } catch (error) {
        console.error("❌ Failed to set webhook:", error);
      }
    } else {
      console.log("📡 WEBHOOK_URL not set; starting Telegram long polling.");
      console.log("   Long polling clears any existing webhook and keeps pending updates.");
      void bot
        .launch()
        .catch((error) => {
          console.error("❌ Telegram long polling failed:", error);
          process.exit(1);
        });
    }
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log("Shutting down...");
    if (!webhookUrl) {
      try {
        bot.stop(signal);
      } catch {
        // The bot may still be connecting when shutdown is requested.
      }
    }
    server.close(() => {
      if (pool) {
        void pool.end().finally(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

// Start the server
startServer().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
