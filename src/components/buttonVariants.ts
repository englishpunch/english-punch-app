import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-sm",
        danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
        secondary:
          "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 shadow-sm",
        ghost: "text-primary-700 hover:bg-gray-100",
        plain: "",
      },
      size: {
        md: "px-4 py-3",
        sm: "px-3 py-2 text-sm",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
