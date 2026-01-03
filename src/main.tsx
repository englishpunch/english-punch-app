import ReactDOM from "react-dom/client";
import React from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import { getConvexClient } from "./lib/convexClient";

const convex = getConvexClient();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ConvexAuthProvider client={convex}>
      <App />
    </ConvexAuthProvider>
  </React.StrictMode>
);
