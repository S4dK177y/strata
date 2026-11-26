"use client";

import {
  createContext,
  useCallback,
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

async function animateAndClose(dialog: HTMLDialogElement): Promise<void> {
  if (!dialog.open || dialog.hasAttribute("data-closing")) return;

  dialog.setAttribute("data-closing", "");
  if (dialog.hasAttribute("data-dragging")) {
    dialog.removeAttribute("data-dragging");
  }

  // Clear any inline drag transform on next frame so CSS transitions smoothly from the
  // finger release position to the closed transform instead of snapping back to 0.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      dialog.style.transform = "";
      requestAnimationFrame(() => resolve());
    });
  });

  const animations = dialog.getAnimations({ subtree: false });
  if (animations.length > 0) {
    await Promise.race([
      Promise.allSettled(animations.map((a) => a.finished)),
      new Promise((resolve) => setTimeout(resolve, 380)),
    ]);
  }

  if (!dialog.hasAttribute("data-closing")) return;
  dialog.removeAttribute("data-closing");
  dialog.style.transform = "";
  if (dialog.open) {
    dialog.close();
  }
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
  const dragZoneRef = useRef<HTMLDivElement>(null);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { t } = useI18n();

  const requestClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.removeAttribute("data-closing");
      dialog.removeAttribute("data-dragging");
      dialog.style.transform = "";
      if (!dialog.open) {
        dialog.showModal();
      }
      setPortalEl(dialog);
    } else if (dialog.open) {
      void animateAndClose(dialog);
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.removeAttribute("data-closing");
      dialog.removeAttribute("data-dragging");
      dialog.style.transform = "";
      dialog.returnValue = "";
      onOpenChange(false);
    };

    const handleCancel = (e: Event) => {
      e.preventDefault();
      if (dismissible) {
        onOpenChange(false);
      }
    };

    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleCancel);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleCancel);
    };
  }, [dismissible, onOpenChange]);

  // Light-dismiss via backdrop click routed through onOpenChange so exit animates cleanly
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !dismissible) return;

    let pressedOutside = false;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      pressedOutside = isPointerOutsideDialog(e, dialog);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isPointerOutsideDialog(e, dialog)) {
        onOpenChange(false);
      }
      pressedOutside = false;
    };

    dialog.addEventListener("pointerdown", onPointerDown);
    dialog.addEventListener("pointerup", onPointerUp);
    return () => {
      dialog.removeEventListener("pointerdown", onPointerDown);
      dialog.removeEventListener("pointerup", onPointerUp);
    };
  }, [dismissible, onOpenChange]);

  // Mobile swipe-to-dismiss drag gesture on the top grab handle & header
  useEffect(() => {
    const dialog = dialogRef.current;
    const dragZone = dragZoneRef.current;
    if (!dialog || !dragZone || !dismissible) return;

    let activePointerId: number | null = null;
    let startY = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocityY = 0;
    let currentOffset = 0;
    let dragging = false;

    const resetDragState = () => {
      activePointerId = null;
      dragging = false;
      currentOffset = 0;
      velocityY = 0;
      dragZone.removeAttribute("data-dragging");
      dialog.removeAttribute("data-dragging");
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || window.innerWidth >= 640) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-dialog-close]")) return;

      activePointerId = e.pointerId;
      startY = e.clientY;
      lastY = e.clientY;
      lastTime = performance.now();
      velocityY = 0;
      currentOffset = 0;
      dragging = false;
      dragZone.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (activePointerId !== e.pointerId || !dragZone.hasPointerCapture(e.pointerId)) return;

      const rawDy = e.clientY - startY;
      if (!dragging && Math.abs(rawDy) > 4) {
        dragging = true;
        dragZone.setAttribute("data-dragging", "");
        dialog.setAttribute("data-dragging", "");
      }
      if (!dragging) return;

      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      velocityY = (e.clientY - lastY) / dt;
      lastY = e.clientY;
      lastTime = now;

      currentOffset = rawDy >= 0 ? rawDy : rawDy * 0.14;
      dialog.style.transform = `translate3d(0, ${currentOffset}px, 0)`;
    };

    const finishDrag = () => {
      if (!dragging) {
        resetDragState();
        return;
      }

      const dismissThreshold = Math.min(110, dialog.offsetHeight * 0.25);
      const shouldDismiss = currentOffset >= dismissThreshold || velocityY > 0.55;

      if (shouldDismiss) {
        activePointerId = null;
        dragging = false;
        dragZone.removeAttribute("data-dragging");
        onOpenChange(false);
      } else {
        resetDragState();
        dialog.style.transform = "";
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (activePointerId !== e.pointerId) return;
      if (dragZone.hasPointerCapture(e.pointerId)) {
        dragZone.releasePointerCapture(e.pointerId);
      }
      finishDrag();
    };

    const onLostCapture = () => {
      if (activePointerId !== null) {
        finishDrag();
      }
    };

    dragZone.addEventListener("pointerdown", onPointerDown);
    dragZone.addEventListener("pointermove", onPointerMove);
    dragZone.addEventListener("pointerup", onPointerUp);
    dragZone.addEventListener("pointercancel", onLostCapture);
    dragZone.addEventListener("lostpointercapture", onLostCapture);

    return () => {
      dragZone.removeEventListener("pointerdown", onPointerDown);
      dragZone.removeEventListener("pointermove", onPointerMove);
      dragZone.removeEventListener("pointerup", onPointerUp);
      dragZone.removeEventListener("pointercancel", onLostCapture);
      dragZone.removeEventListener("lostpointercapture", onLostCapture);
    };
  }, [dismissible, onOpenChange]);

  const closedByProps = {
    closedby: "closerequest",
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
        <div ref={dragZoneRef} className="strata-sheet-handle shrink-0 sm:cursor-auto">
          <div className="flex justify-center pt-2.5 sm:hidden">
            <button
              type="button"
              onClick={requestClose}
              aria-label={t.common.close}
              className="flex h-4 w-16 cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
            >
              <span className="h-1 w-10 rounded-full bg-[var(--strata-border-strong)]" />
            </button>
          </div>

          <div className="flex items-start justify-between gap-4 border-b border-[var(--strata-border-subtle)] px-5 py-3.5 sm:px-6 sm:py-4">
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
              data-dialog-close="true"
              onClick={requestClose}
              aria-label={t.common.close}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--strata-bg-elevated)] text-[var(--strata-text-secondary)] transition hover:text-[var(--strata-text-primary)]"
            >
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="strata-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-5 sm:pb-5">
          {children}
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
