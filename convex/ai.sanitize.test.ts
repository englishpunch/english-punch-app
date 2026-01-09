import { describe, expect, it } from "vitest";

/**
 * Test for sanitizeFinalAnswer logic
 * This function sanitizes the finalAnswer field by checking if it's the string "null" or "undefined"
 * and converting it to undefined if so.
 */
const sanitizeFinalAnswer = (
  finalAnswer: string | undefined
): string | undefined => {
  if (
    finalAnswer === "null" ||
    finalAnswer === "undefined" ||
    finalAnswer === ""
  ) {
    return undefined;
  }
  return finalAnswer;
};

describe("sanitizeFinalAnswer", () => {
  it('should convert string "null" to undefined', () => {
    const result = sanitizeFinalAnswer("null");
    expect(result).toBeUndefined();
  });

  it('should convert string "undefined" to undefined', () => {
    const result = sanitizeFinalAnswer("undefined");
    expect(result).toBeUndefined();
  });

  it("should convert empty string to undefined", () => {
    const result = sanitizeFinalAnswer("");
    expect(result).toBeUndefined();
  });

  it("should return undefined when input is undefined", () => {
    const result = sanitizeFinalAnswer(undefined);
    expect(result).toBeUndefined();
  });

  it("should keep valid string values unchanged", () => {
    const result = sanitizeFinalAnswer("surpassed");
    expect(result).toBe("surpassed");
  });

  it("should keep valid string values with special characters unchanged", () => {
    const result = sanitizeFinalAnswer("look forward to");
    expect(result).toBe("look forward to");
  });

  it("should not confuse valid strings containing 'null' as substring", () => {
    const result = sanitizeFinalAnswer("nullify");
    expect(result).toBe("nullify");
  });

  it("should not confuse valid strings containing 'undefined' as substring", () => {
    const result = sanitizeFinalAnswer("undefined behavior");
    expect(result).toBe("undefined behavior");
  });
});
