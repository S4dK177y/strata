"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

export type OtpCodeStatus = "idle" | "verifying" | "error" | "success";

interface OtpCodeInputProps {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  onBlur?: () => void;
  status?: OtpCodeStatus;
  disabled?: boolean;
  autoFocus?: boolean;
  required?: boolean;
  enterKeyHint?: "done" | "next" | "go" | "send";
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  containerRef?: RefObject<HTMLDivElement | null>;
  className?: string;
}

const SLOTS = [0, 1, 2, 3, 4, 5] as const;

export function OtpCodeInput({
  id,
  name = "otp",
  value,
  onChange,
  onComplete,
  onBlur,
  status = "idle",
  disabled = false,
  autoFocus = false,
  required = false,
  enterKeyHint = "done",
  ariaDescribedBy,
  ariaInvalid = false,
  inputRef: externalInputRef,
  containerRef,
  className,
}: OtpCodeInputProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? internalRef;
  const lastCompletedRef = useRef<string>("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (value.length < 6) {
      lastCompletedRef.current = "";
    }
  }, [value]);

  const isLocked = disabled || status === "verifying" || status === "success";
  const activeIndex = Math.min(value.length, 5);

  return (
    <div
      ref={containerRef}
      className={cn("relative mx-auto w-full max-w-[336px]", className)}
    >
      <div
        aria-hidden="true"
        className={cn(
          "grid grid-cols-6 gap-2 select-none",
          status === "error" && "strata-otp-shake"
        )}
      >
        {SLOTS.map((slotIndex) => {
          const char = value[slotIndex] ?? "";
          const isCurrent = focused && slotIndex === activeIndex && status === "idle";
          const isChecking = status === "verifying";

          return (
            <div
              key={slotIndex}
              style={isChecking ? { animationDelay: `${slotIndex * 55}ms` } : undefined}
              className={cn(
                "flex h-12 items-center justify-center rounded-2xl border bg-[var(--strata-bg-canvas)]/70 transition-colors duration-150 sm:h-[52px]",
                status === "success"
                  ? "border-[var(--strata-accent-brand)] bg-[var(--strata-bg-surface)]"
                  : status === "error" || ariaInvalid
                    ? "border-[var(--strata-money-expense)]"
                    : isCurrent
                      ? "border-[var(--strata-accent-brand)] bg-[var(--strata-bg-surface)] ring-2 ring-[var(--strata-accent-brand)]/25"
                      : char
                        ? "border-[var(--strata-border-strong)] bg-[var(--strata-bg-surface)]"
                        : "border-[var(--strata-border-subtle)]",
                isChecking && "strata-otp-cell-checking"
              )}
            >
              {char ? (
                <span
                  key={`digit-${slotIndex}`}
                  className="strata-mono strata-otp-digit-morph text-lg font-bold text-[var(--strata-text-primary)]"
                >
                  {char}
                </span>
              ) : (
                <span
                  key={`dot-${slotIndex}`}
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    isCurrent
                      ? "strata-otp-dot-idle bg-[var(--strata-accent-brand)]"
                      : "strata-otp-dot-idle bg-[var(--strata-text-muted)]/60"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        pattern="\d{6}"
        maxLength={6}
        enterKeyHint={enterKeyHint}
        autoFocus={autoFocus}
        required={required}
        disabled={isLocked}
        aria-invalid={ariaInvalid || status === "error" ? "true" : "false"}
        aria-describedby={ariaDescribedBy}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        onChange={(e) => {
          if (isLocked) return;
          const digitsOnly = e.target.value.replace(/\D+/g, "").slice(0, 6);
          onChange(digitsOnly);
          if (digitsOnly.length < 6) {
            lastCompletedRef.current = "";
          } else if (digitsOnly.length === 6 && digitsOnly !== lastCompletedRef.current) {
            lastCompletedRef.current = digitsOnly;
            onComplete?.(digitsOnly);
          }
        }}
        className="absolute inset-0 h-full w-full cursor-text rounded-2xl text-base opacity-0"
      />
    </div>
  );
}
