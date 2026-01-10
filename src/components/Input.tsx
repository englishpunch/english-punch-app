import * as React from "react";
import { cn } from "@/lib/utils";
import { inputVariants, type InputVariantProps } from "./inputVariants";

type InputProps = React.ComponentProps<"input"> & InputVariantProps;

const resolveInputClassName = ({
  className,
  variant,
  padding,
  fullWidth,
}: InputVariantProps & { className?: string }) => {
  const resolvedVariant = variant ?? "default";
  const resolvedPadding = padding ?? "default";

  return cn(
    inputVariants({
      variant: resolvedVariant,
      padding: resolvedPadding,
      fullWidth,
    }),
    className
  );
};

export function Input({
  className,
  variant,
  padding,
  fullWidth,
  ref,
  ...props
}: InputProps) {
  return (
    <input
      ref={ref}
      className={resolveInputClassName({
        className,
        variant,
        padding,
        fullWidth,
      })}
      {...props}
    />
  );
}

type TextareaProps = React.ComponentProps<"textarea"> & InputVariantProps;

export function Textarea({
  className,
  variant,
  padding,
  fullWidth,
  ref,
  ...props
}: TextareaProps) {
  return (
    <textarea
      ref={ref}
      className={resolveInputClassName({
        className,
        variant,
        padding,
        fullWidth,
      })}
      {...props}
    />
  );
}

type SelectProps = React.ComponentProps<"select"> & InputVariantProps;

export function Select({
  className,
  variant,
  padding,
  fullWidth,
  ref,
  ...props
}: SelectProps) {
  return (
    <select
      ref={ref}
      className={resolveInputClassName({
        className,
        variant,
        padding,
        fullWidth,
      })}
      {...props}
    />
  );
}
