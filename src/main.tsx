import ReactDOM from "react-dom/client";
import React from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

import App from "./App";
import { getConvexClient } from "./lib/convexClient";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConvexAuthProvider client={convex}>
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    </ConvexAuthProvider>
  </React.StrictMode>
);
