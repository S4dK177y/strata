"use client";

import type { ComponentProps, MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const ROUTE_ORDER: Array<{ prefix: string; index: number }> = [
  { prefix: "/operations", index: 1 },
  { prefix: "/capital", index: 2 },
  { prefix: "/settings", index: 3 },
];

function getRouteIndex(path: string): number {
  for (const item of ROUTE_ORDER) {
    if (path.startsWith(item.prefix)) return item.index;
  }
  return 0;
}

let pendingTransitionResolve: (() => void) | null = null;
let pendingTransitionTimer: ReturnType<typeof setTimeout> | null = null;

export function notifyRouteChanged(): void {
  if (pendingTransitionTimer) {
    clearTimeout(pendingTransitionTimer);
    pendingTransitionTimer = null;
  }
  if (pendingTransitionResolve) {
    const resolve = pendingTransitionResolve;
    pendingTransitionResolve = null;
    resolve();
  }
}

type TransitionLinkProps = ComponentProps<typeof Link>;

export function TransitionLink({
  href,
  onClick,
  ...props
}: TransitionLinkProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented) return;

    if (
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      props.target === "_blank"
    ) {
      return;
    }

    const hrefStr = typeof href === "string" ? href : href.pathname ?? "";
    if (!hrefStr.startsWith("/") || hrefStr === pathname) {
      return;
    }

    const currentIdx = getRouteIndex(pathname);
    const targetIdx = getRouteIndex(hrefStr);
    const dir = targetIdx >= currentIdx ? "forward" : "backward";
    document.documentElement.dataset.navDir = dir;

    const docWithVT = document as Document & {
      startViewTransition?: (cb: () => Promise<void> | void) => {
        finished: Promise<void>;
      };
    };

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!docWithVT.startViewTransition || reducedMotion) {
      return;
    }

    e.preventDefault();
    notifyRouteChanged();

    docWithVT.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          pendingTransitionResolve = resolve;
          pendingTransitionTimer = setTimeout(() => {
            notifyRouteChanged();
          }, 320);
          router.push(hrefStr);
        })
    );
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}
