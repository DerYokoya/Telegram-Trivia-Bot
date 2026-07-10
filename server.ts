// server.ts
import http from "http";
import { setupWebhook } from "./webhook";
import { healthCheck } from "./health";
import { pool } from "./db";

const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = "/webhook";

async function startServer() {
  const bot = await setupWebhook();
  
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
    console.log(`🔄 Webhook endpoint: ${WEBHOOK_PATH}`);

    // Set webhook with Telegram
    const webhookUrl = `${process.env.WEBHOOK_URL || `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}`}${WEBHOOK_PATH}`;
    
    if (process.env.WEBHOOK_URL) {
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
      console.warn("⚠️ WEBHOOK_URL not set. Webhook not configured.");
    }
  });

  // Graceful shutdown
  process.once("SIGINT", () => {
    console.log("Shutting down...");
    server.close(() => {
      if (pool) pool.end();
      process.exit(0);
    });
  });
  
  process.once("SIGTERM", () => {
    console.log("Shutting down...");
    server.close(() => {
      if (pool) pool.end();
      process.exit(0);
    });
  });
}

// Start the server
startServer().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});