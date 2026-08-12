import Link from "next/link";
import { ZCOOL_QingKe_HuangYou } from "next/font/google";
import { BookOpen, Bot, Home, Search } from "lucide-react";
import { WorkbenchLink } from "./workbench-link";

const brandFont = ZCOOL_QingKe_HuangYou({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  fallback: ["PingFang SC", "Microsoft YaHei", "sans-serif"],
});

type SiteTopNavigationProps = Readonly<{
  active: "home" | "workbench" | "guide";
  actions?: React.ReactNode;
}>;

export function SiteTopNavigation({ active, actions }: SiteTopNavigationProps) {
  return (
    <header className="site-top-navigation">
      <div className="site-top-navigation-inner">
        <Link className="site-top-brand" href="/" aria-label="选品猫首页">
          <Bot className="site-top-brand-logo" size={27} strokeWidth={2.5} />
          <strong
            className={brandFont.className}
            data-brand-font="zcool-qingke-huangyou"
            style={{ fontSize: 22, fontWeight: 400, letterSpacing: "0.05em" }}
          >
            选品猫
          </strong>
        </Link>

        <nav className="site-top-tabs" aria-label="选品猫导航">
          <Link className={active === "home" ? "active" : undefined} href="/">
            <Home size={16} />
            首页
          </Link>
          <WorkbenchLink className={active === "workbench" ? "active" : undefined}>
            <Search size={16} />
            选品工作台
          </WorkbenchLink>
          <Link className={active === "guide" ? "active" : undefined} href="/guide">
            <BookOpen size={16} />
            使用说明
          </Link>
        </nav>

        {actions ? <div className="site-top-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
