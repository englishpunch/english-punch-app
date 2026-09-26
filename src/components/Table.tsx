import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { ComponentProps } from "react";

const tableWrapperVariants = cva(
  "overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm",
  {
    variants: {
      edgeToEdge: {
        true: "rounded-none border-x-0 shadow-none",
      },
    },
  }
);

type TableWrapperProps = ComponentProps<"div"> &
  VariantProps<typeof tableWrapperVariants>;

export function TableWrapper({
  className,
  edgeToEdge,
  ...props
}: TableWrapperProps) {
  return (
    <div
      className={cn(tableWrapperVariants({ edgeToEdge }), className)}
      {...props}
    />
  );
}

type TableProps = ComponentProps<"table">;

export function Table({ className, ...props }: TableProps) {
  return (
    <table
      className={cn(
        "w-full border-separate border-spacing-0 text-left text-sm",
        className
      )}
      {...props}
    />
  );
}

type THeadProps = ComponentProps<"thead">;

export function THead({ className, ...props }: THeadProps) {
  return <thead className={cn("bg-gray-50", className)} {...props} />;
}

type TBodyProps = ComponentProps<"tbody">;

export function TBody({ className, ...props }: TBodyProps) {
  return (
    <tbody
      className={cn(
        "[&>tr:not(:last-child)>td]:border-b [&>tr:not(:last-child)>td]:border-gray-100",
        className
      )}
      {...props}
    />
  );
}

type TrProps = ComponentProps<"tr">;

export function Tr({ className, ...props }: TrProps) {
  return <tr className={cn("hover:bg-gray-50/70", className)} {...props} />;
}

type ThProps = ComponentProps<"th">;

export function Th({ className, ...props }: ThProps) {
  return (
    <th
      className={cn(
        "border-b border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-600",
        className
      )}
      {...props}
    />
  );
}

type TdProps = ComponentProps<"td">;

export function Td({ className, ...props }: TdProps) {
  return <td className={cn("px-3 py-2 align-top", className)} {...props} />;
}
