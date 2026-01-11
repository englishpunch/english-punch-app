import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariantProps } from "./buttonVariants";

type ButtonProps = React.ComponentProps<"button"> &
  ButtonVariantProps & {
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  fullWidth,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const isDisabled = disabled || loading;

  const buttonContent = (
    <>
      <span
        className={cn(
          "inline-flex items-center justify-center gap-2 transition-opacity duration-200 ease-out",
          loading && "opacity-10"
        )}
      >
        {children}
      </span>
      <span
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200 ease-out",
          loading ? "opacity-100" : "opacity-0"
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      </span>
    </>
  );

  return (
    <Comp
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      data-loading={loading ? "" : undefined}
      className={cn(
        buttonVariants({ variant, size, fullWidth }),
        "relative",
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {buttonContent}
    </Comp>
  );
}
