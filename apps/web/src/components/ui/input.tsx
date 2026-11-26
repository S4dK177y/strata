import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "strata-input min-h-11 w-full rounded-2xl border border-transparent bg-[var(--strata-bg-elevated)] px-4 py-2.5 text-sm text-[var(--strata-text-primary)] placeholder:text-[var(--strata-text-muted)] transition duration-150 hover:border-[var(--strata-border-subtle)] focus:border-[var(--strata-border-strong)] disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
