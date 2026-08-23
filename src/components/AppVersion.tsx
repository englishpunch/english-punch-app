import { ENGLISH_PUNCH_VERSION } from "@/lib/version";

export function AppVersion() {
  return (
    <span
      aria-label={`English Punch version ${ENGLISH_PUNCH_VERSION}`}
      className="font-mono text-xs text-gray-600"
    >
      v{ENGLISH_PUNCH_VERSION}
    </span>
  );
}
