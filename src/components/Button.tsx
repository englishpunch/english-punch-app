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
  const normalizedChildren = React.Children.toArray(children).map(
    (child, index) => {
      if (typeof child === "string" || typeof child === "number") {
        return (
          <span key={index} className="button-text">
            {child}
          </span>
        );
      }
      return child;
    }
  );

  return (
    <Comp
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      data-loading={loading ? "" : undefined}
      className={cn(
        buttonVariants({ variant, size, fullWidth }),
        "relative *:transition-opacity *:duration-200 *:ease-out data-loading:[&>*:not(.button-loader)]:opacity-10",
        className
      )}
      disabled={isDisabled}
      {...props}
    >
      {normalizedChildren}
      <span
        className={cn(
          "button-loader pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200 ease-out",
          loading ? "opacity-100" : "opacity-0"
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      </span>
    </Comp>
  );
}
