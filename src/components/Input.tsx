import { cn } from "@/lib/utils";
import { inputVariants, type InputVariantProps } from "./inputVariants";
import { ComponentProps, ComponentPropsWithRef } from "react";

type InputProps = ComponentPropsWithRef<"input"> & InputVariantProps;

const resolveInputClassName = ({
  className,
  ...props
}: InputVariantProps & { className?: string }) => {
  return cn(inputVariants(props), className);
};

export function Input({ ...props }: InputProps) {
  return <input {...props} className={resolveInputClassName(props)} />;
}

type TextareaProps = ComponentProps<"textarea"> &
  InputVariantProps & {
    autoResize?: boolean;
    minRows?: number;
    maxRows?: number;
  };

export function Textarea(props: TextareaProps) {
  return <textarea {...props} className={resolveInputClassName(props)} />;
}

type SelectProps = ComponentProps<"select"> & InputVariantProps;

export function Select(props: SelectProps) {
  return <select {...props} className={resolveInputClassName(props)} />;
}
