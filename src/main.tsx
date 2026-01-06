import ReactDOM from "react-dom/client";
import React from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { I18nextProvider } from "react-i18next";
import App from "./App";
import { getConvexClient } from "./lib/convexClient";
import i18n from "./i18n";

const convex = getConvexClient();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <ConvexAuthProvider client={convex}>
        <App />
      </ConvexAuthProvider>
    </I18nextProvider>
  </React.StrictMode>
);
