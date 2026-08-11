import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Blocks,
  Bot,
  CheckCircle2,
  Database,
  FileSearch,
  FlaskConical,
  Globe2,
  Layers3,
  Megaphone,
  Network,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { ContactAuthor } from "./contact-author";
import { ProductResearchAnimation } from "./product-research-animation";
import { SiteTopNavigation } from "./site-top-navigation";

export const metadata: Metadata = {
  title: "选品猫｜让每一条选品结论都有来源",
  description: "使用自己的模型完成联网研究，把市场、用户、竞品和供应证据整理为可追溯的选品白板。",
};

const reportModules = [
  { title: "市场与机会", body: "有没有市场、需求趋势、价格空间与竞争强度。", icon: BarChart3, tone: "market" },
  { title: "用户画像", body: "谁在买、什么场景触发、最焦虑什么、为什么下单。", icon: Users, tone: "customer" },
  { title: "竞品分析", body: "谁在卖、如何吸引点击、建立信任并完成成交。", icon: FileSearch, tone: "competitor" },
  { title: "产品方案", body: "应该做成什么样、必要要求、寻源关键词与风险。", icon: PackageSearch, tone: "product" },
  { title: "营销打法", body: "核心价值主张、广告钩子、内容素材与表达边界。", icon: Megaphone, tone: "marketing" },
  { title: "验证方案", body: "买什么样品、测试什么、成本红线与停止条件。", icon: FlaskConical, tone: "validation" },
] as const;

export default function HomePage() {
  return (
    <div className="landing-shell">
      <SiteTopNavigation
        active="home"
        actions={(
          <>
            <ContactAuthor />
            <Link
              className="primary"
              href="/discover/plan/whiteboard?discoveryId=discovery-3d-yoga-pants-999d4e8e5cc2-us"
            >
              查看示例报告 <ArrowRight size={15} />
            </Link>
          </>
        )}
      />

      <main className="home-product-page">
        <section className="home-story-hero">
          <span className="home-story-pill"><Sparkles size={15} />基于第一性原理的选品研究 Agent</span>
          <h1>数据都有出处，<br />选品心里有数。</h1>
          <p>使用你自己的模型联网寻找市场、用户、竞品、供应与合规证据。从搜过什么，到为什么得出结论，再到下一步怎么验证，全部留在一张可追溯白板上。</p>
          <div className="home-product-actions">
            <Link className="home-product-button dark" href="/discover">开始一次调研 <ArrowRight size={16} /></Link>
            <Link className="home-product-button light" href="/guide">查看使用说明</Link>
          </div>
          <div className="home-story-proof">
            <span><Bot size={16} /><b>你的模型</b><small>使用自己的额度与环境</small></span>
            <span><Globe2 size={16} /><b>真实联网</b><small>基于当前公开资料求证</small></span>
            <span><ShieldCheck size={16} /><b>来源透明</b><small>结论可点击追溯信源</small></span>
            <span><RefreshCw size={16} /><b>持续更新</b><small>新数据进入新的报告版本</small></span>
          </div>
        </section>

        <section className="home-story-product-view">
          <header>
            <span className="home-product-kicker">报告从开始就已经出现</span>
            <h2>不是研究结束后才生成文档，而是边调研、边形成一张决策白板。</h2>
            <p>白板同时承担调研过程、证据索引与最终报告。用户可以看到 Agent 正在查什么、用了哪些来源、形成了哪些判断，以及还有什么没有被证明。</p>
          </header>
          <ProductResearchAnimation />
        </section>

        <section className="home-story-modules">
          <header>
            <span className="home-product-kicker">一整轮研究，不是一份资料汇总</span>
            <h2>六个经营问题，共同指向“下一步该不该做”。</h2>
            <p>每个模块默认先说人话给出核心判断，再把证据、反向证据、未知项和来源放进可展开的审计层。</p>
          </header>
          <div className="home-module-grid">
            {reportModules.map((module, index) => {
              const Icon = module.icon;
              return (
                <article className={module.tone} key={module.title}>
                  <header><span>0{index + 1}</span><Icon size={22} /></header>
                  <h3>{module.title}</h3>
                  <p>{module.body}</p>
                  <b>查看结论与证据 <ArrowRight size={13} /></b>
                </article>
              );
            })}
          </div>
        </section>

        <section className="home-first-principles">
          <header>
            <div><span className="home-product-kicker">为什么报告更有参考价值</span><h2>不是先找一个看起来能卖的商品，再为它补理由。</h2></div>
            <p>选品不该是猜爆款，而是把生意重新想明白。第一性原理让研究从真实需求与经营约束出发，而不是从平台榜单或竞品话术倒推答案。</p>
          </header>
          <div>
            <article><Network size={24} /><span>01 / 机制</span><h3>需求为什么存在？</h3><p>拆解使用场景、触发原因、替代方案和支付意愿，判断问题是否真实且持续。</p></article>
            <article><Layers3 size={24} /><span>02 / 边界</span><h3>证据究竟证明什么？</h3><p>竞品页面不能证明目标商品效果，供应页面不能代表正式报价，方向性机会不能冒充确定市场。</p></article>
            <article><CheckCircle2 size={24} /><span>03 / 行动</span><h3>下一步凭什么继续？</h3><p>把结论转成可以买什么样品、应该测试什么、何时通过，以及什么时候必须停止。</p></article>
          </div>
        </section>

        <section className="home-source-system">
          <div className="home-source-copy">
            <span className="home-product-kicker">接入你的数据工具栈</span>
            <h2>生而开放，让信源能力跟着你的工具一起生长。</h2>
            <p>选品猫先使用公开网络完成基础调研。以后可以接入自己的 MCP、数据库或 API，让同一套研究逻辑获得更广、更深、更及时的证据。</p>
            <ul>
              <li><b>现在</b><span>公开网页、平台页面、用户讨论、品牌与供应信息</span></li>
              <li><b>可扩展</b><span>SEMrush、FastMoss、平台 API、评论数据库、供应链系统</span></li>
              <li><b>不变</b><span>所有新数据仍保留来源、时间、批次和影响范围</span></li>
            </ul>
          </div>
          <div className="home-source-map" aria-label="可扩展数据源结构">
            <div className="home-source-core"><Bot className="home-source-logo" size={46} strokeWidth={2.5} /><strong>选品猫研究 Agent</strong><span>统一证据结构</span></div>
            <span className="source-orbit web"><Globe2 size={17} /><b>公开网络</b></span>
            <span className="source-orbit mcp"><Network size={17} /><b>第三方 MCP</b></span>
            <span className="source-orbit api"><Blocks size={17} /><b>业务 API</b></span>
            <span className="source-orbit data"><Database size={17} /><b>自有数据库</b></span>
          </div>
        </section>

        <section className="home-update-loop">
          <header>
            <div>
              <span className="home-product-kicker">报告不会在导出那一刻失效</span>
              <h2>补充新证据，只更新真正受到影响的结论。</h2>
            </div>
            <p>后来又多了 500 条评论、一个供应商报价，或一批 SEMrush 数据，都可以作为新的证据批次进入原调研。旧版本保留，新版本说明变化来自哪里。</p>
          </header>
          <div className="home-update-diagram">
            <article><span>V1</span><b>现有报告</b><small>原始证据与结论保持不变</small></article>
            <i><ArrowRight size={18} /></i>
            <article className="new-data"><span>NEW</span><b>新增证据批次</b><small>来源、时间、数量与去重记录</small></article>
            <i><ArrowRight size={18} /></i>
            <article className="recompute"><span>影响分析</span><b>只重算相关模块</b><small>同时检查反向证据与结论降级</small></article>
            <i><ArrowRight size={18} /></i>
            <article className="next-version"><span>V2</span><b>生成新版本</b><small>明确展示更新前、更新后和变化原因</small></article>
          </div>
        </section>

        <section className="home-faq">
          <header><span className="home-product-kicker">常见问题</span><h2>开始之前，你可能还想知道</h2></header>
          <div>
            <details><summary>选品猫会直接告诉我应该卖什么吗？</summary><p>它会给出是否值得继续、机会在哪里、竞争强度如何，以及下一步验证建议；不会把证据不足的方向包装成确定会成功的商品。</p></details>
            <details><summary>为什么要使用我自己的模型？</summary><p>如果模型由平台替你决定，你很难知道它优先考虑的是研究效果还是成本。使用自己的模型，能力档位和费用都由你控制，愿意投入更多，也可以直接选择更强的模型。对话记录、研究过程和报告会留在自己的电脑里，后续可以沿着原来的任务继续追问、补充证据和更新结论。</p></details>
            <details><summary>联网搜索到的内容都算有效证据吗？</summary><p>不是。搜索结果只是发现入口，保留的证据必须打开并核验来源。无法访问、只看到摘要或属于竞品自述的内容会单独标记边界。</p></details>
            <details><summary>以后接入 SEMrush 或 FastMoss，需要重做报告吗？</summary><p>不需要推翻原报告。新接口数据会作为新的证据批次加入，再重新计算受影响的市场、竞品或营销结论并生成新版本。</p></details>
          </div>
        </section>

        <section className="home-product-cta">
          <div><span>从一条关键词、一张图片或一个竞品链接开始</span><h2>把一轮选品调研的全过程，真正掌握在自己手里。</h2></div>
          <Link className="home-product-button lime" href="/discover">打开选品工作台 <ArrowRight size={16} /></Link>
        </section>
      </main>
    </div>
  );
}
