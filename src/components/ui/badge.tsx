import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Badge({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "primary" | "quiet" | "reviewed" | "ok";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 min-h-6 text-[0.7rem] font-semibold tracking-wide",
        tone === "default" && "bg-sunken text-ink",
        tone === "primary" && "bg-primary text-primary-ink",
        tone === "quiet" && "text-muted shadow-[inset_0_0_0_1px_var(--color-line)]",
        tone === "reviewed" && "bg-primary/12 text-primary",
        tone === "ok" && "bg-ok/12 text-ok",
        className,
      )}
      {...props}
    />
  );
}
