import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type SwitchProps = Omit<
  ComponentProps<"button">,
  "aria-checked" | "onClick" | "role" | "type"
> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function Switch({
  checked,
  className,
  disabled,
  onCheckedChange,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "focus-visible:outline-primary-400 inline-flex h-11 min-w-11 items-center justify-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400",
        className
      )}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      {...props}
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-out motion-reduce:transition-none",
          checked ? "bg-primary-600" : "bg-gray-300"
        )}
        aria-hidden
      >
        <span
          className={cn(
            "pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none",
            checked && "translate-x-4"
          )}
        />
      </span>
    </button>
  );
}
