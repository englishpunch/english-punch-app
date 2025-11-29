import { useSearch } from "@tanstack/react-router";

export default function useIsMock() {
  return useSearch({
    from: "__root__",
    select: (s) => s.mock,
  });
}
