import { createContext, useContext } from "react";
import type { AccountSessions } from "./accountSessions";

export const AccountSessionsContext = createContext<AccountSessions | null>(
  null
);
export const useAccountSessions = () => useContext(AccountSessionsContext);
