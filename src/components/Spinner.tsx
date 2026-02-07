import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const spinnerVariants = cva("animate-spin text-primary-600", {
  variants: {
    size: {
      sm: "h-4 w-4",
      md: "h-6 w-6",
      lg: "h-10 w-10",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const wrapperVariants = cva("flex items-center justify-center", {
  variants: {
    wrapper: {
      none: "",
      page: "py-12",
      fullscreen: "min-h-screen bg-white",
      overlay: "absolute inset-0 bg-white/75",
    },
  },
  defaultVariants: {
    wrapper: "none",
  },
});

type SpinnerProps = VariantProps<typeof spinnerVariants> &
  VariantProps<typeof wrapperVariants> & {
    className?: string;
    "data-testid"?: string;
  };

export function Spinner({
  size,
  wrapper,
  className,
  "data-testid": testId,
}: SpinnerProps) {
  const icon = (
    <Loader2 className={cn(spinnerVariants({ size }), className)} aria-hidden />
  );

  if (!wrapper || wrapper === "none") {
    return icon;
  }

  return (
    <div className={wrapperVariants({ wrapper })} data-testid={testId}>
      {icon}
    </div>
  );
}
