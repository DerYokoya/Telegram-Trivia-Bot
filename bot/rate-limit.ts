import type { Context } from "telegraf";
import { Config } from "./config";

interface RateLimitInfo {
  count: number;
  firstRequestAt: number;
}

const userQuizCounts = new Map<number, RateLimitInfo>();
const QUIZ_COOLDOWN_MS = 30_000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function checkRateLimit(userId: number): {
  allowed: boolean;
  remaining?: number;
} {
  const now = Date.now();
  const info = userQuizCounts.get(userId);

  if (!info || now - info.firstRequestAt > RATE_LIMIT_WINDOW_MS) {
    userQuizCounts.set(userId, { count: 1, firstRequestAt: now });
    return { allowed: true };
  }

  if (info.count >= Config.MAX_QUIZZES_PER_HOUR) {
    const hoursLeft = Math.ceil(
      (info.firstRequestAt + RATE_LIMIT_WINDOW_MS - now) / 3600000,
    );
    return { allowed: false, remaining: hoursLeft };
  }

  info.count++;
  userQuizCounts.set(userId, info);
  return { allowed: true };
}

const recentQuizRequests = new Map<number, number>();

export function getCooldownRemainingMs(userId: number): number {
  const last = recentQuizRequests.get(userId) ?? 0;
  return Math.max(0, last + QUIZ_COOLDOWN_MS - Date.now());
}

export function recordQuizRequest(userId: number): void {
  recentQuizRequests.set(userId, Date.now());
}

export function getRequesterId(ctx: Context): number | null {
  const from = (ctx as any).from;
  if (from && typeof from.id === "number") return from.id;
  return ctx.chat?.id ?? null;
}

export function isRateLimited(userId: number): boolean {
  return getCooldownRemainingMs(userId) > 0;
}