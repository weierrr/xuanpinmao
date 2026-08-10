"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const ACTIVE_WORKBENCH_KEY = "xuanpinmao:active-workbench";
const discoveryIdPattern = /^discovery-[a-z0-9-]+$/;

export const restorableWorkbenchHref = (value: string): string | null => {
  try {
    const url = new URL(value, "http://xuanpinmao.local");
    const discoveryId = url.searchParams.get("discoveryId") ?? "";
    if (url.pathname !== "/discover/plan/whiteboard" || !discoveryIdPattern.test(discoveryId)) {
      return null;
    }
    return `/discover/plan/whiteboard?discoveryId=${encodeURIComponent(discoveryId)}`;
  } catch {
    return null;
  }
};

type WorkbenchLinkProps = Readonly<{
  children: React.ReactNode;
  className?: string;
}>;

/** Return to the whiteboard last opened in this browser, otherwise start discovery. */
export function WorkbenchLink({ children, className }: WorkbenchLinkProps) {
  const [href, setHref] = useState("/discover");

  useEffect(() => {
    try {
      const current = restorableWorkbenchHref(`${window.location.pathname}${window.location.search}`);
      if (current) {
        window.localStorage.setItem(ACTIVE_WORKBENCH_KEY, current);
        setHref(current);
        return;
      }

      const saved = restorableWorkbenchHref(window.localStorage.getItem(ACTIVE_WORKBENCH_KEY) ?? "");
      if (saved) {
        setHref(saved);
      } else {
        window.localStorage.removeItem(ACTIVE_WORKBENCH_KEY);
      }
    } catch {
      // Storage can be unavailable in privacy modes; /discover remains the safe fallback.
    }
  }, []);

  return <Link className={className} href={href}>{children}</Link>;
}
