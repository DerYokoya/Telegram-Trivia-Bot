import { suite } from "uvu";
import * as assert from "uvu/assert";
import {
  clearLeaderboard,
  getCategoryLeaderboard,
  getGlobalLeaderboard,
  recordResult,
  type LeaderboardEntry,
} from "../bot/leaderboard";

const test = suite("leaderboard");

test.before.each(() => {
  clearLeaderboard();
});

test("sorts by score then speed", () => {
  recordResult({
    userId: 1,
    nickname: "fast",
    topic: "General",
    category: "general",
    difficulty: "easy",
    correct: 4,
    total: 5,
    avgSpeedMs: 1200,
    recordedAt: Date.now(),
  });
  recordResult({
    userId: 2,
    nickname: "slow",
    topic: "General",
    category: "general",
    difficulty: "easy",
    correct: 4,
    total: 5,
    avgSpeedMs: 900,
    recordedAt: Date.now(),
  });
  const leaderboard = getGlobalLeaderboard();
  assert.is(leaderboard[0]?.userId, 2);
  assert.is(leaderboard[1]?.userId, 1);
});

test("matches category words exactly", () => {
  recordResult({
    userId: 3,
    nickname: "history",
    topic: "War History",
    category: "war history",
    difficulty: "medium",
    correct: 3,
    total: 5,
    avgSpeedMs: 1500,
    recordedAt: Date.now(),
  });
  const results = getCategoryLeaderboard("history");
  assert.is(results.length, 1);
  assert.is(results[0]?.userId, 3);
});

test.run();
