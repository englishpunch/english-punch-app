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

type TextareaProps = React.ComponentProps<"textarea"> &
  InputVariantProps & {
    autoResize?: boolean;
    minRows?: number;
    maxRows?: number;
  };

export function Textarea({
  className,
  variant,
  padding,
  fullWidth,
  autoResize = false,
  minRows = 3,
  maxRows,
  value,
  onChange,
  ref: externalRef,
  ...props
}: TextareaProps) {
  const internalRef = React.useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef || internalRef;

  const adjustHeight = React.useCallback(() => {
    if (!autoResize) {
      return;
    }

    const textarea =
      textareaRef && "current" in textareaRef ? textareaRef.current : null;
    if (!textarea) {
      return;
    }

    // Reset height to auto to get the correct scrollHeight
    // eslint-disable-next-line react-hooks/immutability
    textarea.style.height = "auto";

    // Calculate the line height
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = parseInt(computedStyle.lineHeight);

    // Calculate min and max heights based on rows
    const minHeight = lineHeight * minRows;
    const maxHeight = maxRows ? lineHeight * maxRows : Infinity;

    // Set the height based on content, respecting min and max
    const newHeight = Math.min(
      Math.max(textarea.scrollHeight, minHeight),
      maxHeight
    );
    textarea.style.height = `${newHeight}px`;

    // Add overflow if content exceeds maxRows
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [autoResize, textareaRef, minRows, maxRows]);

  React.useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onChange) {
      onChange(e);
    }
    adjustHeight();
  };

  return (
    <textarea
      ref={textareaRef}
      className={resolveInputClassName({
        className,
        variant,
        padding,
        fullWidth,
      })}
      value={value}
      onChange={handleChange}
      style={autoResize ? { resize: "none", overflow: "hidden" } : undefined}
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
