import { cva, type VariantProps } from "class-variance-authority";

export const inputVariants = cva("", {
  variants: {
    variant: {
      default:
        "focus:border-primary-500 focus:ring-primary-500 rounded-md border border-gray-200 text-base focus:ring-1",
    },
    padding: {
      default: "px-3 py-2",
      icon: "py-2 pr-3 pl-10",
      none: "",
    },
    fullWidth: {
      true: "w-full",
      false: "",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "default",
    fullWidth: true,
  },
});

export type InputVariantProps = VariantProps<typeof inputVariants>;
