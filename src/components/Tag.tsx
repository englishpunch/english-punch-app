import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Tag({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium break-words text-gray-700",
        className
      )}
      {...props}
    />
  );
}
