import { useEffect, useState } from "react";

/** Refresh time-based availability while open and when returning to the app. */
export function useDueCountAsOf() {
  const [asOf, setAsOf] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setAsOf(Date.now());
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return asOf;
}
