import Link from "next/link";
import { ArrowRight, FolderSearch, Gem, GitBranch, Home, Search } from "lucide-react";
import { WorkbenchLink } from "./workbench-link";

type WorkbenchShellProps = Readonly<{
  active: "discover" | "network" | "projects";
  children: React.ReactNode;
}>;

export function WorkbenchShell({ active, children }: WorkbenchShellProps) {
  const pageTitle = active === "network" ? "人群需求发现网络" : "多入口商品发现";
  const PageIcon = active === "network" ? GitBranch : FolderSearch;
  return (
    <div className="workspace-shell">
      <aside className="workspace-rail">
        <Link className="workspace-brand" href="/" aria-label="选品猫首页">
          <Gem size={20} strokeWidth={2.4} />
          <strong>选品猫</strong>
        </Link>
        <span className="workspace-rail-label">应用</span>
        <nav aria-label="选品猫导航">
          <Link href="/"><Home size={16} />首页</Link>
          <WorkbenchLink className="active"><Search size={16} />选品工作台</WorkbenchLink>
        </nav>
      </aside>

      <main className="workspace-main">
        <header className="workspace-utility-row">
          <Link href="/">返回首页</Link>
          <Link className="primary" href="/discover">开始发现 <ArrowRight size={15} /></Link>
        </header>

        <div className="workspace-title-row">
          <div>
            <span>PRODUCT RESEARCH WORKBENCH</span>
            <h1>{pageTitle}</h1>
          </div>
          <PageIcon size={54} strokeWidth={1.3} aria-hidden="true" />
        </div>

        {children}
      </main>
    </div>
  );
}
