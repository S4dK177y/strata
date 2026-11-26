"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  asChild?: boolean;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--strata-accent-brand)] text-white shadow-[var(--strata-shadow-neon)] hover:opacity-90",
  secondary:
    "bg-[var(--strata-bg-elevated)] text-[var(--strata-text-primary)] border border-[var(--strata-border-subtle)] hover:border-[var(--strata-border-strong)]",
  outline:
    "bg-transparent text-[var(--strata-text-primary)] border border-[var(--strata-border-strong)] hover:bg-[var(--strata-bg-elevated)]",
  ghost:
    "bg-transparent text-[var(--strata-text-secondary)] hover:bg-[var(--strata-bg-elevated)] hover:text-[var(--strata-text-primary)]",
  destructive:
    "bg-[var(--strata-money-expense)] text-white hover:opacity-90",
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "min-h-10 px-3.5 py-2 text-xs rounded-xl",
  md: "min-h-11 px-4 py-2.5 text-sm rounded-xl",
  lg: "min-h-12 px-5 py-3 text-sm rounded-2xl",
  icon: "min-h-11 min-w-11 p-2.5 rounded-xl",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild = false, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center gap-2 font-semibold transition duration-200 ease-out disabled:pointer-events-none disabled:opacity-50",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
