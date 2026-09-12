import Link from "next/link";
import { BookOpen, Bot, Home, Newspaper } from "lucide-react";

type SiteTopNavigationProps = Readonly<{
  active: "home" | "workbench" | "guide" | "blog";
  actions?: React.ReactNode;
}>;

export function SiteTopNavigation({ active, actions }: SiteTopNavigationProps) {
  return (
    <header className="site-top-navigation">
      <div className="site-top-navigation-inner">
        <Link className="site-top-brand" href="/" aria-label="选品猫首页">
          <Bot className="site-top-brand-logo" size={27} strokeWidth={2.5} />
          <strong
            className="alimama-shu-hei-ti"
            data-brand-font="alimama-shu-hei-ti"
            style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.04em" }}
          >
            选品猫
          </strong>
        </Link>

        <nav className="site-top-tabs" aria-label="选品猫导航">
          <Link className={active === "home" ? "active" : undefined} href="/">
            <Home size={16} />
            首页
          </Link>
          <Link className={active === "guide" ? "active" : undefined} href="/guide">
            <BookOpen size={16} />
            使用说明
          </Link>
          <Link className={active === "blog" ? "active" : undefined} href="/blog">
            <Newspaper size={16} />
            选品干货
          </Link>
        </nav>

        {actions ? <div className="site-top-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
