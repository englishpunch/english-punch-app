import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const renderMock = vi.fn();
const rootMock = { render: renderMock };
const createRootMock = vi.fn(() => rootMock);

vi.mock("react-dom/client", () => ({
  __esModule: true,
  createRoot: createRootMock,
  default: { createRoot: createRootMock },
}));

const convexInstance = { kind: "convex" };
const convexClientMock = vi.fn(function MockConvexReactClient() {
  return convexInstance;
});

vi.mock("convex/react", () => {
  const ConvexProvider = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="convex-provider">{children}</div>
  );

  return {
    ConvexReactClient: convexClientMock,
    ConvexProvider,
  };
});

vi.mock("@convex-dev/auth/react", () => {
  const ConvexAuthProvider = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  );

  return { ConvexAuthProvider };
});

// Ensure TanStack Query is not pulled into the web entry bundle
vi.mock("@tanstack/react-query", () => {
  throw new Error("TanStack Query should not be imported by the web entry");
});

vi.mock("./App", () => ({ default: () => <div data-testid="app" /> }));

describe("main entry for Netlify/web build", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
    renderMock.mockReset();
    createRootMock.mockClear();
    convexClientMock.mockClear();
  });

  it("creates ConvexReactClient from env and renders without TanStack Query", async () => {
    process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

    await import("./main");

    expect(convexClientMock).toHaveBeenCalledWith(
      "https://example.convex.cloud"
    );
    expect(createRootMock).toHaveBeenCalledWith(
      document.getElementById("root")
    );
    expect(renderMock).toHaveBeenCalled();
  });
});
