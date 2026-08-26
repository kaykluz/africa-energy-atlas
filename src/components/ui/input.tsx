import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md bg-surface px-3.5 text-[0.95rem] text-ink shadow-[inset_0_0_0_1px_var(--color-line)] placeholder:text-faint outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-primary)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-lg bg-surface px-3.5 py-3 text-[0.95rem] text-ink shadow-[inset_0_0_0_1px_var(--color-line)] placeholder:text-faint outline-none focus:shadow-[inset_0_0_0_1.5px_var(--color-primary)]",
        className,
      )}
      {...props}
    />
  );
}
