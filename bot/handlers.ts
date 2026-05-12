// handlers.ts - simpler version without complex type checking
import { Context } from "telegraf";
import { QuizSession } from "./quiz";
import { validateTopic, validateNickname } from "./validation";
import { Markup } from "telegraf";

const COUNT_OPTIONS = [5, 10, 15, 20];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildCountKeyboard(prefix: "count" | "gcount") {
  return Markup.inlineKeyboard(
    COUNT_OPTIONS.map((n) =>
      Markup.button.callback(String(n), `${prefix}:${n}`),
    ),
    { columns: 4 },
  );
}

export async function handleSoloTopic(
  ctx: Context,
  session: QuizSession,
  text: string
): Promise<boolean> {
  const validation = validateTopic(text) as { valid: boolean; error?: string; normalized?: string };
  if (!validation.valid) {
    await ctx.reply(validation.error!);
    return false;
  }
  
  // Use the normalized value if it exists
  session.topic = validation.normalized || text;
  session.phase = "awaiting_count";
  await ctx.reply(
    `Topic: <b>${escapeHtml(session.topic)}</b>\n\nHow many questions?`,
    { 
      parse_mode: "HTML", 
      ...buildCountKeyboard("count") 
    }
  );
  return true;
}

export async function handleNicknameSubmission(
  ctx: Context,
  session: QuizSession,
  text: string
): Promise<boolean> {
  const validation = validateNickname(text) as { valid: boolean; error?: string; normalized?: string };
  if (!validation.valid) {
    await ctx.reply(validation.error!);
    return false;
  }
  
  session.nickname = validation.normalized || text;
  session.phase = "idle";
  return true;
}