import Link from "next/link";
import { ArrowRight, FolderSearch, GitBranch } from "lucide-react";
import { SiteTopNavigation } from "./site-top-navigation";

type WorkbenchShellProps = Readonly<{
  active: "discover" | "network" | "projects";
  children: React.ReactNode;
  hideTitle?: boolean;
}>;

export function WorkbenchShell({ active, children, hideTitle = false }: WorkbenchShellProps) {
  const pageTitle = active === "network" ? "人群需求发现网络" : "多入口商品发现";
  const PageIcon = active === "network" ? GitBranch : FolderSearch;
  return (
    <div className="workspace-shell">
      <SiteTopNavigation
        active="workbench"
        actions={(
          <Link
            className="primary"
            href="/discover/plan/whiteboard?discoveryId=discovery-category-9ff30cf30ef8-us"
          >
            查看示例报告 <ArrowRight size={15} />
          </Link>
        )}
      />

      <main className={`workspace-main${hideTitle ? " workspace-main-titleless" : ""}`}>
        {hideTitle ? null : (
          <div className="workspace-title-row">
            <div>
              <span>PRODUCT RESEARCH WORKBENCH</span>
              <h1>{pageTitle}</h1>
            </div>
            <PageIcon size={54} strokeWidth={1.3} aria-hidden="true" />
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
