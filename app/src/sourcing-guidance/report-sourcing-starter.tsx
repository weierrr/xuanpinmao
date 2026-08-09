import { Factory, Search } from "lucide-react";
import { CopySourcingButton } from "./copy-sourcing-button";
import { sourcingCopyText } from "./service";
import type { SourcingStarter } from "./types";

export function ReportSourcingStarter({ starter }: Readonly<{ starter: SourcingStarter }>) {
  return (
    <section className="report-sourcing-starter" aria-labelledby="sourcing-starter-title">
      <header className="report-sourcing-head">
        <div className="report-sourcing-title">
          <span className="report-sourcing-icon"><Search size={20} /></span>
          <div>
            <span>SOURCING STARTER / 寻源起点</span>
            <h3 id="sourcing-starter-title">{starter.title}</h3>
          </div>
        </div>
        <CopySourcingButton text={sourcingCopyText(starter)} />
      </header>

      <div className="report-sourcing-keywords" aria-label="核心寻源关键词">
        {starter.coreKeywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
      </div>
      <p className="report-sourcing-notice">{starter.notice}</p>
      <a className="report-sourcing-next-link" href="#candidate-verification-title">
        找到商品后，继续核验具体变体和同款程度
      </a>

      <details className="report-sourcing-details">
        <summary>展开组合搜索词和工厂询盘话术</summary>
        <div className="report-sourcing-detail-grid">
          <div>
            <h4><Search size={17} />1688 组合搜索</h4>
            <ul>{starter.combinationQueries.map((query) => <li key={query}>{query}</li>)}</ul>
          </div>
          <div>
            <h4><Factory size={17} />发给工厂的话</h4>
            <p>{starter.supplierBrief}</p>
          </div>
          <div>
            <h4>排除条件</h4>
            <ul>{starter.exclusions.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      </details>
    </section>
  );
}
