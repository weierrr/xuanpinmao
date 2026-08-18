"use client";

import { usePathname } from "next/navigation";
import { Boxes } from "lucide-react";
import { ProjectNavigation } from "./navigation";

/** The report is a standalone reading view: no workbench menu around it. */
export const isStandaloneReportPath = (pathname: string): boolean =>
  /^\/research\/[^/]+\/report\/?$/.test(pathname);

/** Reading pages that can be opened and shared without the internal workbench. */
export const isStandaloneReadingPath = (pathname: string): boolean =>
  /^\/research\/[^/]+\/(?:report|opportunities)\/?$/.test(pathname);

/** Public product pages own the branded top navigation and editorial canvas. */
export const isStandaloneLandingPath = (pathname: string): boolean =>
  pathname === "/" || pathname === "/guide" || pathname === "/blog" || pathname.startsWith("/blog/");

/** Public workbench entry points share the branded workspace chrome. */
export const isStandaloneWorkbenchPath = (pathname: string): boolean =>
  pathname === "/discover"
  || pathname.startsWith("/discover/plan")
  || pathname === "/discover/network"
  || pathname === "/projects";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const standalone = isStandaloneReadingPath(pathname)
    || isStandaloneLandingPath(pathname)
    || isStandaloneWorkbenchPath(pathname);

  if (standalone) {
    return <div className="shell shell-standalone"><main className="main main-standalone">{children}</main></div>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Boxes size={20} />
          <span>买样前机会研究</span>
        </div>
        <ProjectNavigation />
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
