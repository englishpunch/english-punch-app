import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariantProps } from "./buttonVariants";

type ButtonProps = React.ComponentPropsWithoutRef<"button"> &
  ButtonVariantProps & {
    asChild?: boolean;
    ref?: React.Ref<HTMLButtonElement>;
  };

export function Button({
  className,
  variant,
  size,
  fullWidth,
  type,
  asChild = false,
  ref,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...(asChild ? props : { type: type ?? "button", ...props })}
    />
  );
}
