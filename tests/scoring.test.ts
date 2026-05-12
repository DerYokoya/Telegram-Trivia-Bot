import { describe, it, expect } from "vitest";
import { calculateWeightedScore } from "../bot/scoring";

describe("Scoring System", () => {
  it("calculates base scores correctly", () => {
    const perfectScore = calculateWeightedScore({
      correct: 10,
      total: 10,
      avgSpeedMs: 15000,
      difficulty: "easy",
    });
    expect(perfectScore).toBeGreaterThan(900);
    
    const partialScore = calculateWeightedScore({
      correct: 5,
      total: 10,
      avgSpeedMs: 15000,
      difficulty: "easy",
    });
    expect(partialScore).toBeLessThan(perfectScore);
  });
  
  it("applies difficulty multipliers", () => {
    const easy = calculateWeightedScore({
      correct: 10,
      total: 10,
      avgSpeedMs: 15000,
      difficulty: "easy",
    });
    
    const hard = calculateWeightedScore({
      correct: 10,
      total: 10,
      avgSpeedMs: 15000,
      difficulty: "hard",
    });
    
    expect(hard).toBeGreaterThan(easy);
  });
  
  it("applies speed bonuses", () => {
    const slow = calculateWeightedScore({
      correct: 10,
      total: 10,
      avgSpeedMs: 25000,
      difficulty: "easy",
    });
    
    const fast = calculateWeightedScore({
      correct: 10,
      total: 10,
      avgSpeedMs: 4000,
      difficulty: "easy",
    });
    
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeGreaterThan(slow * 1.2);
  });
  
  it("handles zero total gracefully", () => {
    const score = calculateWeightedScore({
      correct: 0,
      total: 0,
      avgSpeedMs: 0,
      difficulty: "easy",
    });
    expect(score).toBe(0);
  });
  
  it("gives perfect bonus", () => {
    const perfectWithBonus = calculateWeightedScore({
      correct: 10,
      total: 10,
      avgSpeedMs: 15000,
      difficulty: "easy",
    });
    
    const almostPerfect = calculateWeightedScore({
      correct: 9,
      total: 10,
      avgSpeedMs: 15000,
      difficulty: "easy",
    });
    
    const bonusRatio = perfectWithBonus / almostPerfect;
    expect(bonusRatio).toBeCloseTo(1.1, 1);
  });
});