"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesCombined,
  ClipboardCheck,
  Database,
  FileText,
  Layers3,
  ListChecks,
  PackageSearch,
  Search,
  type LucideIcon,
} from "lucide-react";

type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const fixtureRunId = "T21-full-20260714";
const fixtureProjectId = "project-t21-fixture";
const researchProjectPrefix = "research-project-";

const pathSegment = (pathname: string, prefix: string): string | null => {
  if (!pathname.startsWith(prefix)) return null;
  return pathname.slice(prefix.length).split("/")[0] || null;
};

export const navigationItemsForPath = (pathname: string): NavigationItem[] => {
  const researchRunId = pathSegment(pathname, "/research/");
  const databaseRunId = pathSegment(pathname, "/runs/");
  const routeProjectId = pathSegment(pathname, "/projects/");
  const projectRunId = routeProjectId === fixtureProjectId
    ? fixtureRunId
    : routeProjectId?.startsWith(researchProjectPrefix)
      ? routeProjectId.slice(researchProjectPrefix.length)
      : null;
  const runId = researchRunId ?? databaseRunId ?? projectRunId;
  const projectId = routeProjectId
    ?? (runId === fixtureRunId
      ? fixtureProjectId
      : runId
        ? `${researchProjectPrefix}${runId}`
        : null);
  const items: NavigationItem[] = [
    { href: "/discover", label: "发现品类机会", icon: Search },
    { href: "/projects", label: "项目列表", icon: PackageSearch },
  ];

  if (!runId || !projectId) return items;

  // A live research run has exactly one report. Everything that used to be its
  // own menu entry is now a chapter or an appendix block inside that report.
  if (runId.startsWith("research-run-")) {
    items.push(
      { href: `/research/${runId}/report`, label: "选品报告", icon: FileText },
      { href: `/projects/${projectId}`, label: "项目概览", icon: ClipboardCheck },
      { href: `/runs/${runId}`, label: "运行详情", icon: ListChecks },
    );
    return items;
  }

  items.push(
    { href: `/projects/${projectId}`, label: "项目概览", icon: ClipboardCheck },
    { href: `/runs/${runId}`, label: "运行详情", icon: ListChecks },
    { href: `/runs/${runId}/evidence`, label: "证据中心", icon: Database },
    { href: `/runs/${runId}/risk`, label: "风险模块", icon: Layers3 },
    { href: `/runs/${runId}/economics`, label: "单位经济", icon: ChartNoAxesCombined },
    { href: `/runs/${runId}/decision`, label: "决策报告", icon: FileText },
  );

  return items;
};

export function ProjectNavigation() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="主导航">
      {navigationItemsForPath(pathname).map((item) => {
        const Icon = item.icon;
        return (
          <Link href={item.href} key={item.href} aria-current={pathname === item.href ? "page" : undefined}>
            <Icon size={16} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
