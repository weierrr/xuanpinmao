import type { Metadata } from "next";
import { ImageIcon, Link2, Search } from "lucide-react";
import { WorkbenchShell } from "../workbench-shell";

export const metadata: Metadata = {
  title: "快速发现｜选品猫",
  description: "同时提交关键词、图片和商品链接，确认研究对象后回到 Codex 继续调研。",
};

const resultLayers = [
  ["01", "市场与机会", "有没有市场、需求趋势、价格空间与竞争强度。"],
  ["02", "用户画像", "谁在买、什么场景触发、最焦虑什么、为什么下单。"],
  ["03", "竞品分析", "谁在卖、靠什么吸引点击、建立信任并促成成交。"],
  ["04", "产品方案", "应该做成什么样、必要产品要求、寻源关键词和避坑边界。"],
  ["05", "营销打法", "核心价值主张、广告钩子、内容素材，以及可说与不可说。"],
  ["06", "验证方案", "买什么样品、测试什么、成本红线、通过和停止条件。"],
] as const;

const firstParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function DiscoveryEntryPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const query = await searchParams;
  const category = firstParam(query.category ?? query.keyword);
  const imageUrls = firstParam(query.imageUrls ?? query.images);
  const competitorUrls = firstParam(query.competitorUrls ?? query.references);
  const market = firstParam(query.market) || "US";
  const channel = firstParam(query.channel) || "independent_dtc";
  const audience = firstParam(query.audience);
  const error = firstParam(query.error);

  return (
    <WorkbenchShell active="discover" hideTitle>
      <section className="workspace-discover-hero">
        <div>
          <span>开始前先看这三步</span>
          <h2>三步开始一轮选品调研</h2>
          <p>关键词、图片和商品链接可以一起填，也可以只填一项。</p>
        </div>
        <ol className="workspace-discover-steps">
          <li><b>01</b><span><strong>填写线索</strong><small>填关键词、商品图片或商品链接。</small></span></li>
          <li><b>02</b><span><strong>确认研究对象</strong><small>检查产品、市场和销售渠道是否正确。</small></span></li>
          <li><b>03</b><span><strong>回到 Codex 继续</strong><small>让选品猫开始收集证据并更新白板。</small></span></li>
        </ol>
      </section>

      <form id="discovery-inputs" action="/discover/plan" method="get" className="workspace-discover-form">
        <fieldset className="workspace-mode-field">
          <legend>组合研究线索 · 三项可同时填写，至少填写一项</legend>
          <div className="workspace-signal-grid">
            <label className="workspace-signal-card">
              <span className="workspace-signal-head"><Search size={17} /><span><strong>商品关键词</strong><small>品类词、产品词、痛点词或使用场景</small></span></span>
              <input name="category" defaultValue={category} placeholder="例如：冰箱滤芯、无缝提臀瑜伽裤" />
            </label>
            <label className="workspace-signal-card">
              <span className="workspace-signal-head"><ImageIcon size={17} /><span><strong>商品图片</strong><small>粘贴公开可访问的图片网址，一行一个</small></span></span>
              <textarea name="imageUrls" defaultValue={imageUrls} rows={3} placeholder={"https://example.com/product-front.jpg\nhttps://example.com/product-detail.jpg"} />
            </label>
            <label className="workspace-signal-card">
              <span className="workspace-signal-head"><Link2 size={17} /><span><strong>竞品或商品链接</strong><small>独立站、平台商品页或品牌页面，一行一个</small></span></span>
              <textarea name="competitorUrls" defaultValue={competitorUrls} rows={3} placeholder={"https://example.com/product-a\nhttps://example.com/product-b"} />
            </label>
          </div>
        </fieldset>

        {error === "missing-input" ? <p className="workspace-form-error">请至少填写商品关键词、商品图片或商品链接中的一项。</p> : null}

        <label className="workspace-field">
          <span>目标市场</span>
          <select name="market" defaultValue={market}>
            <option value="US">美国</option>
            <option value="UK">英国</option>
            <option value="CA">加拿大</option>
            <option value="AU">澳大利亚</option>
            <option value="EU">欧盟</option>
          </select>
          <small>用于限定竞品、价格与合规范围。</small>
        </label>
        <label className="workspace-field">
          <span>目标销售渠道</span>
          <select name="channel" defaultValue={channel}>
            <option value="independent_dtc">独立站 / DTC</option>
            <option value="amazon">Amazon</option>
            <option value="tiktok_shop">TikTok Shop</option>
            <option value="walmart_marketplace">Walmart Marketplace</option>
            <option value="etsy">Etsy</option>
          </select>
          <small>没有对应渠道时，可在补充说明中填写。</small>
        </label>
        <label className="workspace-field workspace-note-field">
          <span>给 AI 的补充说明 · 可选</span>
          <textarea name="audience" maxLength={1000} defaultValue={audience} placeholder="例如：主要研究美国家庭使用的替换滤芯；优先关注兼容型号、过滤认证、复购频率、漏水风险和品牌兼容性。" />
          <small>可填写目标客群、价格带、产品偏好、排除条件或希望重点调查的问题。</small>
        </label>
        <button className="workspace-discover-submit" type="submit">确认研究对象 →</button>
      </form>

      <section className="workspace-result-section">
        <div className="workspace-section-head">
          <h2>一组线索，六份调研结果</h2>
          <span>从市场判断到验证方案</span>
        </div>
        <div className="workspace-result-grid">
          {resultLayers.map(([index, title, description]) => (
            <article key={index}>
              <span>{index}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
    </WorkbenchShell>
  );
}
