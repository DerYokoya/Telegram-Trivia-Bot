// tests/validation.test.ts
import { describe, it, expect } from "vitest";
import { validateTopic, validateNickname } from "../bot/validation";

describe("Input Validation", () => {
  describe("Topic validation", () => {
    it("accepts valid topics", () => {
      const result = validateTopic("World War II");
      expect(result.valid).toBe(true);
    });

    it("rejects too short topics", () => {
      const result = validateTopic("a");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("2 characters");
    });

    it("rejects too long topics", () => {
      const longTopic = "a".repeat(121);
      const result = validateTopic(longTopic);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("120 characters");
    });

    it("trims whitespace", () => {
      const result = validateTopic("  Math  ");
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe("Math"); // Works without type assertion
    });

    it("rejects excessive emojis", () => {
      const result = validateTopic("Math 😀😀😀😀😀😀");
      expect(result.valid).toBe(false);
    });

    it("rejects control characters", () => {
      const result = validateTopic("Math\x00Topic");
      expect(result.valid).toBe(false);
    });
  });

  describe("Nickname validation", () => {
    it("accepts valid nicknames", () => {
      const result = validateNickname("John Doe");
      expect(result.valid).toBe(true);
    });

    it("rejects too short", () => {
      const result = validateNickname("");
      expect(result.valid).toBe(false);
    });

    it("rejects too long", () => {
      const longName = "a".repeat(25);
      const result = validateNickname(longName);
      expect(result.valid).toBe(false);
    });

    it("rejects offensive content", () => {
      const result = validateNickname("badword_fuck");
      expect(result.valid).toBe(false);
    });

    it("normalizes unicode", () => {
      const result = validateNickname("Café") as {
        valid: boolean;
        error?: string;
        normalized?: string;
      };
      expect(result.valid).toBe(true);
      expect(result.normalized).toBeDefined();
    });
  });
});
