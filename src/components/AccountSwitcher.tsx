import { useAccountSessions } from "@/lib/accountSessionsContext";
import AccountSwitcherContent from "./AccountSwitcherContent";

type User = { _id: string; email?: string; name?: string };

export default function AccountSwitcher({
  user,
  disabled = false,
  expanded = false,
}: {
  user: User | null;
  disabled?: boolean;
  expanded?: boolean;
}) {
  const sessions = useAccountSessions();
  if (!sessions) {
    return null;
  }
  return (
    <AccountSwitcherContent
      sessions={sessions}
      user={user}
      disabled={disabled}
      expanded={expanded}
    />
  );
}
