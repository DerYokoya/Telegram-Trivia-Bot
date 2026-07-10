import { isUserInTopNGlobal, isUserTop1InAnyCategory } from "./leaderboard";
import { recordLeaderboardPosition, renderNewAchievements } from "./achievements";
import type { Context } from "telegraf";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function isGroupChat(ctx: Context): boolean {
  const type = ctx.chat?.type;
  return type === "group" || type === "supergroup" || type === "channel";
}

export function getSenderName(ctx: Context): string {
  const from = (ctx as any).from;
  if (!from) return "Unknown";
  if (from.first_name && from.last_name)
    return `${from.first_name} ${from.last_name}`;
  if (from.first_name) return from.first_name;
  if (from.username) return `@${from.username}`;
  return `User ${from.id}`;
}

export function getRequesterId(ctx: Context): number | null {
  const from = (ctx as any).from;
  if (from && typeof from.id === "number") return from.id;
  return ctx.chat?.id ?? null;
}

export function chunkText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const lines = text.split("\n");
  const out: string[] = [];
  let buf = "";
  for (const line of lines) {
    if (buf.length + line.length + 1 > max) {
      if (buf) out.push(buf);
      buf = line;
    } else {
      buf = buf ? `${buf}\n${line}` : buf + line;
    }
  }
  if (buf) out.push(buf);
  return out;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = Math.round(ms / 100) / 10;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds - minutes * 60);
  return `${minutes}m ${seconds}s`;
}

export function medal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}.`;
}

export async function checkAndAnnounceLeaderboardAchievements(
  ctx: Context,
  userId: number,
): Promise<void> {
  const isTop5 = isUserInTopNGlobal(userId, 5);
  const isTop1Cat = isUserTop1InAnyCategory(userId);
  const newAchs = await recordLeaderboardPosition(userId, isTop5, isTop1Cat);
  const msg = renderNewAchievements(newAchs);
  if (msg) await ctx.reply(msg, { parse_mode: "HTML" });
}