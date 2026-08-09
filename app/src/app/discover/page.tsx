import type { Metadata } from "next";
import { ImageIcon, Link2, Search } from "lucide-react";
import { WorkbenchShell } from "../workbench-shell";

export const metadata: Metadata = {
  title: "快速发现｜选品猫",
  description: "组合关键词、图片与商品链接，开始证据化选品。",
};

const resultLayers = [
  ["01 / 发现", "识别与扩展", "从关键词、图片和页面共同识别商品方向、同款、相似款与替代方案。"],
  ["02 / 矩阵", "标杆商品矩阵", "按市场、渠道、价格、定位和证据边界组织，而不是堆搜索结果。"],
  ["03 / 验证", "建议与验证动作", "每条建议显示证据类型、可信程度、来源，以及下一步最小测试。"],
  ["04 / 决策", "决策边界", "区分方向性机会、打样、正式供货、上架与广告权限。"],
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
    <WorkbenchShell active="discover">
      <section className="workspace-discover-hero">
        <div>
          <span>发现 → 对标 → 验证 → 决策</span>
          <h2>把手上的线索放在一起，开始证据化选品</h2>
          <p>关键词负责说明你想找什么，图片补充外观与结构，商品链接提供竞品和标杆。三类线索可以同时提交，系统会先确认研究对象，再开始深度调研。</p>
        </div>
        <div className="workspace-discover-mark"><Search size={72} strokeWidth={1.8} /></div>
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
          <h2>一组线索，四层结果</h2>
          <span>市场 · 平台 · 社媒 · 供应候选</span>
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
