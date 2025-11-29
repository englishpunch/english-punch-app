import { ConvexReactClient } from "convex/react";

type GlobalWithConvex = typeof globalThis & {
  __convexClient?: ConvexReactClient;
};

const globalCache = globalThis as GlobalWithConvex;

const resolveConvexUrl = (): string => {
  const url = import.meta.env?.VITE_CONVEX_URL ?? process.env.VITE_CONVEX_URL;

  if (!url) {
    throw new Error("VITE_CONVEX_URL is not configured");
  }

  return url;
};

export const getConvexClient = (): ConvexReactClient => {
  if (globalCache.__convexClient) return globalCache.__convexClient;

  const url = resolveConvexUrl();
  const client = new ConvexReactClient(url);

  globalCache.__convexClient = client;
  return client;
};

export const resetConvexClientCache = () => {
  delete globalCache.__convexClient;
};
