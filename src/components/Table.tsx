import { cn } from "@/lib/utils";
import { ComponentProps } from "react";

type TableWrapperProps = ComponentProps<"div">;

export function TableWrapper({ className, ...props }: TableWrapperProps) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm",
        className
      )}
      {...props}
    />
  );
}

type TableProps = ComponentProps<"table">;

export function Table({ className, ...props }: TableProps) {
  return (
    <table
      className={cn(
        "min-w-full border-separate border-spacing-0 text-sm",
        className
      )}
      {...props}
    />
  );
}

type THeadProps = ComponentProps<"thead">;

export function THead({ className, ...props }: THeadProps) {
  return (
    <thead
      className={cn("border-b border-gray-200 bg-gray-50", className)}
      {...props}
    />
  );
}

type TBodyProps = ComponentProps<"tbody">;

export function TBody({ className, ...props }: TBodyProps) {
  return (
    <tbody className={cn("divide-y divide-gray-200", className)} {...props} />
  );
}

type TrProps = ComponentProps<"tr">;

export function Tr({ className, ...props }: TrProps) {
  return <tr className={cn(className)} {...props} />;
}

type ThProps = ComponentProps<"th">;

export function Th({ className, ...props }: ThProps) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold text-gray-600",
        className
      )}
      {...props}
    />
  );
}

type TdProps = ComponentProps<"td">;

export function Td({ className, ...props }: TdProps) {
  return <td className={cn("px-4 py-3 align-top", className)} {...props} />;
}
