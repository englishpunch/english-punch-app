import { beforeEach, describe, expect, it, Mock, vi } from "vitest";

const convexClientStub = { url: "https://example.convex.cloud" };

vi.mock("convex/react", () => {
  const ConvexReactClient = vi.fn(function mockConvexClient() {
    return convexClientStub;
  });

  return { ConvexReactClient };
});

describe("convex client singleton", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.VITE_CONVEX_URL = "https://example.convex.cloud";
    // @ts-expect-error testing global cache
    delete globalThis.__convexClient;
  });

  it("initializes ConvexReactClient once and reuses the instance", async () => {
    const { getConvexClient } = await import("./convexClient");

    const first = getConvexClient();
    const second = getConvexClient();

    expect(first).toBe(second);

    const { ConvexReactClient } = await import("convex/react");
    const convexCtor = ConvexReactClient as unknown as Mock;

    expect(convexCtor).toHaveBeenCalledTimes(1);
    expect(convexCtor.mock.calls[0][0]).toBe("https://example.convex.cloud");
  });
});
