"use client";

import {
  createContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export const DialogPortalContext = createContext<HTMLElement | null>(null);

interface ModalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  dismissible?: boolean;
  maxWidthClassName?: string;
  children: ReactNode;
}

function isPointerOutsideDialog(e: PointerEvent, dialog: HTMLDialogElement): boolean {
  const rect = dialog.getBoundingClientRect();
  return (
    e.clientX < rect.left ||
    e.clientX > rect.right ||
    e.clientY < rect.top ||
    e.clientY > rect.bottom
  );
}

export function ModalDialog({
  open,
  onOpenChange,
  title,
  description,
  dismissible = true,
  maxWidthClassName = "sm:max-w-lg",
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { t } = useI18n();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      setPortalEl(dialog);
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      onOpenChange(false);
    };

    const handleCancel = (e: Event) => {
      if (!dismissible) {
        e.preventDefault();
      }
    };

    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleCancel);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleCancel);
    };
  }, [dismissible, onOpenChange]);

  // Fallback light-dismiss when browser lacks <dialog closedby="any"> (e.g. Safari)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !dismissible) return;
    if (typeof HTMLDialogElement !== "undefined" && "closedBy" in HTMLDialogElement.prototype) {
      return;
    }

    let pressedOutside = false;
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isPointerOutsideDialog(e, dialog);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isPointerOutsideDialog(e, dialog)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener("pointerdown", onPointerDown);
    dialog.addEventListener("pointerup", onPointerUp);
    return () => {
      dialog.removeEventListener("pointerdown", onPointerDown);
      dialog.removeEventListener("pointerup", onPointerUp);
    };
  }, [dismissible]);

  const closedByProps = {
    closedby: dismissible ? "any" : "closerequest",
  } as Record<string, unknown>;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      {...closedByProps}
      className={cn(
        "strata-dialog fixed inset-x-0 bottom-0 m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[28px] border border-[var(--strata-border-subtle)] bg-[var(--strata-bg-surface)] p-0 text-[var(--strata-text-primary)] shadow-[var(--strata-shadow-card)]",
        "sm:inset-0 sm:m-auto sm:max-h-[88dvh] sm:rounded-3xl",
        maxWidthClassName
      )}
    >
      <DialogPortalContext.Provider value={portalEl}>
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[var(--strata-border-strong)] sm:hidden" />

        <div className="flex items-start justify-between gap-4 border-b border-[var(--strata-border-subtle)] px-5 py-4 sm:px-6">
          <div className="min-w-0 space-y-1">
            <h1
              id={titleId}
              className="text-lg font-bold tracking-tight text-[var(--strata-text-primary)]"
            >
              {title}
            </h1>
            {description ? (
              <p
                id={descriptionId}
                className="text-xs leading-relaxed text-[var(--strata-text-muted)]"
              >
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t.common.close}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--strata-bg-elevated)] text-[var(--strata-text-secondary)] transition hover:text-[var(--strata-text-primary)]"
          >
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {open ? children : null}
        </div>
      </DialogPortalContext.Provider>
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useI18n();

  return (
    <ModalDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      dismissible={!busy}
      maxWidthClassName="sm:max-w-md"
    >
      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
        <Button
          type="button"
          variant="destructive"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? t.common.saving : confirmLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          autoFocus
          disabled={busy}
          onClick={() => onOpenChange(false)}
        >
          {cancelLabel ?? t.common.cancel}
        </Button>
      </div>
    </ModalDialog>
  );
}
