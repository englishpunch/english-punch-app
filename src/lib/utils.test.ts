import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class names and resolves tailwind conflicts", () => {
    // eslint-disable-next-line no-constant-binary-expression
    const result = cn("px-2", ["py-1", false && "hidden"], "px-4", {
      "text-sm": true,
    });

    expect(result).toBe("py-1 px-4 text-sm");
  });

  it("drops falsy values before merging", () => {
    // eslint-disable-next-line no-constant-binary-expression
    const result = cn("text-base", undefined, null, "", false && "hidden", "font-bold");

    expect(result).toBe("text-base font-bold");
  });
});
