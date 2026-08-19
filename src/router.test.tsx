import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let localStorageDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  localStorageDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "localStorage"
  );
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => undefined,
    },
  });
});

afterEach(() => {
  if (localStorageDescriptor) {
    Object.defineProperty(window, "localStorage", localStorageDescriptor);
  } else {
    Reflect.deleteProperty(window, "localStorage");
  }
});

describe("bag detail route", () => {
  it("canonicalizes the default sort before entering and does not intercept departure", async () => {
    const { createAppRouter } = await import("./router");
    const history = createMemoryHistory({
      initialEntries: ["/plans/bag-1"],
    });
    const testRouter = createAppRouter(history);

    await testRouter.load();

    const canonicalSearch = new URLSearchParams(
      testRouter.state.location.searchStr
    );
    expect(canonicalSearch.get("sortBy")).toBe("due");
    expect(canonicalSearch.get("sortDirection")).toBe("asc");

    await testRouter.navigate({
      to: "/plans/$bagId",
      params: { bagId: "bag-1" },
      search: { sortBy: "due", sortDirection: "desc" },
    });
    expect(testRouter.state.location.search.sortDirection).toBe("desc");

    await testRouter.navigate({ to: "/home" });

    expect(testRouter.state.location.pathname).toBe("/home");
  });

  it("replaces invalid sort parameters with the defaults", async () => {
    const { createAppRouter } = await import("./router");
    const history = createMemoryHistory({
      initialEntries: ["/plans/bag-1?sortBy=invalid&sortDirection=invalid"],
    });
    const testRouter = createAppRouter(history);

    await testRouter.load();

    const canonicalSearch = new URLSearchParams(
      testRouter.state.location.searchStr
    );
    expect(canonicalSearch.get("sortBy")).toBe("due");
    expect(canonicalSearch.get("sortDirection")).toBe("asc");
  });
});
