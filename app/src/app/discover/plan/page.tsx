import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ImageIcon, Link2, Search, ShieldCheck } from "lucide-react";
import { WorkbenchShell } from "../../workbench-shell";
import { confirmDiscoveryPlan } from "./actions";
import { ConfirmResearchButton } from "./confirm-research-button";

const firstParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

const parseInputLines = (value: string): string[] => [...new Set(
  value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean),
)];

const isWebUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const marketLabels: Record<string, string> = {
  US: "美国",
  UK: "英国",
  CA: "加拿大",
  AU: "澳大利亚",
  EU: "欧盟",
};

const channelLabels: Record<string, string> = {
  independent_dtc: "独立站 / DTC",
  amazon: "Amazon",
  tiktok_shop: "TikTok Shop",
  walmart_marketplace: "Walmart Marketplace",
  etsy: "Etsy",
};

const sellerQuestions = [
  ["市场与机会", "有没有市场、需求趋势、价格空间、竞争强度。"],
  ["用户画像", "谁在买、什么场景触发、最焦虑什么、为什么下单。"],
  ["竞品分析", "谁在卖、靠什么吸引点击、建立信任和促成成交。"],
  ["产品方案", "应该做成什么样、必要要求、寻源关键词和避坑项。"],
  ["营销打法", "核心价值主张、广告钩子、内容素材和表达边界。"],
  ["验证方案", "买什么样品、测试什么、成本红线和停止条件。"],
] as const;

export default async function DiscoveryPlanPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const query = await searchParams;
  const category = firstParam(query.category).trim();
  const rawImageUrls = parseInputLines(firstParam(query.imageUrls));
  const rawCompetitorUrls = parseInputLines(firstParam(query.competitorUrls));
  const imageUrls = rawImageUrls.filter(isWebUrl);
  const competitorUrls = rawCompetitorUrls.filter(isWebUrl);
  const invalidUrls = [...rawImageUrls, ...rawCompetitorUrls].filter((item) => !isWebUrl(item));
  const market = firstParam(query.market) || "US";
  const channel = firstParam(query.channel) || "independent_dtc";
  const audience = firstParam(query.audience).trim();

  if (!category && rawImageUrls.length === 0 && rawCompetitorUrls.length === 0) {
    redirect("/discover?error=missing-input");
  }

  const researchObject = category
    || (competitorUrls.length > 0 ? "等待从商品链接识别的具体商品" : "等待从商品图片识别的具体商品");

  return (
    <WorkbenchShell active="discover" hideTitle>
      <section className="workspace-scope-confirmation">
        <header className="workspace-scope-head">
          <div>
            <span>RESEARCH OBJECT CONFIRMATION</span>
            <h2>确认研究对象</h2>
            <p>这里只确认要研究的商品、市场和输入边界。确认后才会保存研究任务并启动 Agent 的证据采集流程。</p>
          </div>
          <ShieldCheck size={42} strokeWidth={1.7} />
        </header>

        <div className="workspace-scope-object">
          <span>系统当前理解</span>
          <h1>{researchObject}</h1>
          <dl>
            <div><dt>目标市场</dt><dd>{marketLabels[market] ?? market}</dd></div>
            <div><dt>销售渠道</dt><dd>{channelLabels[channel] ?? channel}</dd></div>
            <div><dt>补充要求</dt><dd>{audience || "暂未补充，后续从证据中识别目标人群与约束"}</dd></div>
          </dl>
        </div>

        <section className="workspace-scope-sources" aria-label="本次研究输入">
          <article className={category ? "has-input" : ""}>
            <Search size={18} /><span><small>商品关键词</small><strong>{category || "未填写"}</strong></span><b>{category ? <Check size={15} /> : "—"}</b>
          </article>
          <article className={imageUrls.length > 0 ? "has-input" : ""}>
            <ImageIcon size={18} /><span><small>商品图片</small><strong>{imageUrls.length > 0 ? `${imageUrls.length} 个图片网址` : "未填写"}</strong></span><b>{imageUrls.length > 0 ? <Check size={15} /> : "—"}</b>
          </article>
          <article className={competitorUrls.length > 0 ? "has-input" : ""}>
            <Link2 size={18} /><span><small>竞品或商品链接</small><strong>{competitorUrls.length > 0 ? `${competitorUrls.length} 个商品页面` : "未填写"}</strong></span><b>{competitorUrls.length > 0 ? <Check size={15} /> : "—"}</b>
          </article>
        </section>

        {invalidUrls.length > 0 ? (
          <aside className="workspace-scope-warning">
            <strong>有 {invalidUrls.length} 个网址格式无法识别</strong>
            <p>这些内容不会进入研究任务。返回修改后再确认，避免遗漏图片或竞品页面。</p>
          </aside>
        ) : null}

        <div className="workspace-scope-boundaries">
          <article>
            <span>本次会怎样使用这些线索</span>
            <p>关键词定义商品方向；图片只用于识别外观、结构和可能的款式；商品链接用于寻找竞品、价格、表达和转化证据。</p>
          </article>
          <article>
            <span>不会自动混在一起的内容</span>
            <p>图片里的相邻品类不会直接并入研究；竞品页面的卖点不会被当成目标产品事实；空气滤芯等相似名称也不会与净水滤芯混用。</p>
          </article>
        </div>

        <section className="workspace-scope-questions">
          <header><span>确认后将获得</span><strong>6 项选品结论</strong></header>
          <ol>
            {sellerQuestions.map(([title, description], index) => (
              <li key={title}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{title}</strong><small>{description}</small></span></li>
            ))}
          </ol>
        </section>

        <form action={confirmDiscoveryPlan} className="workspace-scope-actions">
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="imageUrls" value={imageUrls.join("\n")} />
          <input type="hidden" name="competitorUrls" value={competitorUrls.join("\n")} />
          <input type="hidden" name="market" value={market} />
          <input type="hidden" name="channel" value={channel} />
          <input type="hidden" name="audience" value={audience} />
          <Link href={`/discover?${new URLSearchParams({ category, imageUrls: rawImageUrls.join("\n"), competitorUrls: rawCompetitorUrls.join("\n"), market, channel, audience }).toString()}`}>返回修改</Link>
          <ConfirmResearchButton disabled={invalidUrls.length > 0} />
        </form>
      </section>
    </WorkbenchShell>
  );
}
