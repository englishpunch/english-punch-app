import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "plain";
type Size = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      fullWidth = false,
      type = "button",
      ...props
    },
    ref
  ) {
    const base =
      "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400 disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer";

    const sizeClass = size === "sm" ? "px-3 py-2 text-sm" : "px-4 py-3";

    const variantClass: Record<Variant, string> = {
      primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-sm",
      danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
      secondary:
        "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 shadow-sm",
      ghost: "text-primary-700 hover:bg-gray-100",
      plain: "",
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          base,
          sizeClass,
          variantClass[variant],
          fullWidth && "w-full",
          className
        )}
        {...props}
      />
    );
  }
);
