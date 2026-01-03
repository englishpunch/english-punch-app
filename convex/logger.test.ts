import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("convex logger", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  it("should export log, warn, error, and debug functions", async () => {
    const logger = await import("./logger");
    
    expect(logger.log).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.debug).toBeDefined();
  });

  it("error function always calls console.error", async () => {
    const { error } = await import("./logger");
    
    error("error message", { detail: "test" });
    
    expect(consoleErrorSpy).toHaveBeenCalledWith("error message", { detail: "test" });
  });
});
