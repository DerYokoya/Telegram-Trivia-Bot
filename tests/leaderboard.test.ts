import { describe, it, expect, beforeEach } from "vitest";
import {
  clearLeaderboard,
  recordResult,
  getGlobalLeaderboard,
  getCategoryLeaderboard,
  isUserInTopNGlobal,
  isUserTop1InAnyCategory,
  type LeaderboardEntry,
} from "../bot/leaderboard";

describe("Leaderboard", () => {
  beforeEach(() => {
    clearLeaderboard();
  });

  describe("score calculation", () => {
    it("handles zero total correctly", () => {
      const entry: LeaderboardEntry = {
        userId: 1,
        nickname: "Test",
        topic: "Math",
        category: "math",
        difficulty: "easy",
        correct: 0,
        total: 0,
        avgSpeedMs: 0,
        recordedAt: Date.now(),
      };
      recordResult(entry);
      const leaderboard = getGlobalLeaderboard(10);
      // Score should be 0, not NaN
      expect(leaderboard[0]?.correct).toBe(0);
    });

    it("sorts by percentage first", () => {
      recordResult({
        userId: 1,
        nickname: "High Score",
        topic: "Test",
        category: "test",
        difficulty: "easy",
        correct: 8,
        total: 10,
        avgSpeedMs: 5000,
        recordedAt: Date.now(),
      });

      recordResult({
        userId: 2,
        nickname: "Low Score",
        topic: "Test",
        category: "test",
        difficulty: "easy",
        correct: 5,
        total: 10,
        avgSpeedMs: 1000,
        recordedAt: Date.now(),
      });

      const leaderboard = getGlobalLeaderboard(10);
      expect(leaderboard[0]?.nickname).toBe("High Score");
    });

    it("uses speed as tiebreaker", () => {
      recordResult({
        userId: 1,
        nickname: "Fast",
        topic: "Test",
        category: "test",
        difficulty: "easy",
        correct: 8,
        total: 10,
        avgSpeedMs: 2000,
        recordedAt: Date.now(),
      });

      recordResult({
        userId: 2,
        nickname: "Slow",
        topic: "Test",
        category: "test",
        difficulty: "easy",
        correct: 8,
        total: 10,
        avgSpeedMs: 5000,
        recordedAt: Date.now(),
      });

      const leaderboard = getGlobalLeaderboard(10);
      expect(leaderboard[0]?.nickname).toBe("Fast");
    });
  });

  // tests/leaderboard.test.ts - update the category filtering section
  describe("category filtering", () => {
    beforeEach(() => {
      // Clear and add test data with better category names
      clearLeaderboard();

      recordResult({
        userId: 1,
        nickname: "Math Pro",
        topic: "Algebra",
        category: "math", // Simplified category name
        difficulty: "hard",
        correct: 9,
        total: 10,
        avgSpeedMs: 3000,
        recordedAt: Date.now(),
      });

      recordResult({
        userId: 2,
        nickname: "History Buff",
        topic: "WW2",
        category: "history", // Simplified category name
        difficulty: "medium",
        correct: 7,
        total: 10,
        avgSpeedMs: 4000,
        recordedAt: Date.now(),
      });
    });

    it("filters by category words", () => {
      const mathLeaderboard = getCategoryLeaderboard("math", 10);
      expect(mathLeaderboard.length).toBe(1);
      expect(mathLeaderboard[0]?.nickname).toBe("Math Pro");

      const historyLeaderboard = getCategoryLeaderboard("history", 10);
      expect(historyLeaderboard.length).toBe(1);
      expect(historyLeaderboard[0]?.nickname).toBe("History Buff");
    });

    it("handles partial matches", () => {
      // Add a more complex category
      recordResult({
        userId: 3,
        nickname: "Physics Expert",
        topic: "Quantum Mechanics",
        category: "science physics quantum",
        difficulty: "hard",
        correct: 8,
        total: 10,
        avgSpeedMs: 3500,
        recordedAt: Date.now(),
      });

      const results = getCategoryLeaderboard("physics", 10);
      expect(results.length).toBe(1);
      expect(results[0]?.nickname).toBe("Physics Expert");
    });

    it("returns empty for no matches", () => {
      const results = getCategoryLeaderboard("science", 10);
      expect(results.length).toBe(0);
    });
  });

  describe("user position checks", () => {
    it("correctly identifies top N users", () => {
      for (let i = 1; i <= 10; i++) {
        recordResult({
          userId: i,
          nickname: `User ${i}`,
          topic: "Test",
          category: "test",
          difficulty: "easy",
          correct: 10 - i,
          total: 10,
          avgSpeedMs: 5000,
          recordedAt: Date.now(),
        });
      }

      expect(isUserInTopNGlobal(1, 5)).toBe(true);
      expect(isUserInTopNGlobal(6, 5)).toBe(false);
    });

    it("detects category rank 1", () => {
      // Add multiple users to same category
      recordResult({
        userId: 1,
        nickname: "Winner",
        topic: "Sports",
        category: "sports basketball",
        difficulty: "medium",
        correct: 10,
        total: 10,
        avgSpeedMs: 3000,
        recordedAt: Date.now(),
      });

      recordResult({
        userId: 2,
        nickname: "Runner Up",
        topic: "Sports",
        category: "sports basketball",
        difficulty: "medium",
        correct: 9,
        total: 10,
        avgSpeedMs: 3500,
        recordedAt: Date.now(),
      });

      expect(isUserTop1InAnyCategory(1)).toBe(true);
      expect(isUserTop1InAnyCategory(2)).toBe(false);
    });
  });
});
