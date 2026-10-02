import ReactDOM from "react-dom/client";
import React from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { I18nextProvider } from "react-i18next";
import App from "./App";
import { createAccountSessions } from "./lib/accountSessions";
import { AccountSessionsContext } from "./lib/accountSessionsContext";
import { getConvexClient } from "./lib/convexClient";
import i18n from "./i18n";

const convex = getConvexClient();
const accounts = createAccountSessions(
  localStorage,
  sessionStorage,
  import.meta.env.VITE_CONVEX_URL,
  () => {
    if (window.location.pathname === "/") {
      window.location.hash = "/run";
    }
    window.location.reload();
  }
);

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <AccountSessionsContext.Provider value={accounts}>
        <ConvexAuthProvider
          client={convex}
          storageNamespace={accounts.namespace}
        >
          <App />
        </ConvexAuthProvider>
      </AccountSessionsContext.Provider>
    </I18nextProvider>
  </React.StrictMode>
);
