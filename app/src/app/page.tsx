import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gem, Home, Search } from "lucide-react";
import { ContactAuthor } from "./contact-author";

export const metadata: Metadata = {
  title: "选品猫｜把市场事实变成经营决策",
  description: "从真实问题出发，以联网证据、第一性原理和行动边界完成买样前选品研究。",
};

const promises = [
  {
    index: "01 / 插件原生",
    status: "现在 + 路线图",
    title: "插件即用，让每一次研究都能接着聊",
    body: "可以直接作为 Codex 插件使用，每次对话对应一项独立调研，研究材料、证据版本和报告留在你的项目环境里。",
    foot: "当前：Codex · 后续：更多插件市场",
    tone: "paper",
  },
  {
    index: "02 / 永久免费",
    status: "永久免费",
    title: "我们不卖功能，只消耗你自己的模型额度",
    body: "选品猫不会为功能设置付费墙。你为自己的模型与算力买单，而不是为使用选品工具重复付费。",
    foot: "你的额度 · 你的数据 · 你的报告",
    tone: "lime",
  },
  {
    index: "03 / 商家优先",
    status: "第一性原理",
    title: "从商家的真实痛点出发，不止推荐一个商品",
    body: "报告不只回答“卖什么”，还会覆盖市场信号、竞品结构、用户动机、风险与成本，并继续推导相邻选品机会。",
    foot: "市场 → 用户 → 产品 → 生意 → 延伸机会",
    tone: "paper",
  },
  {
    index: "04 / 真实网络证据",
    status: "证据优先",
    title: "真实联网研究，让结论可以追溯、质疑和补证",
    body: "广泛检索公开用户评论、社区讨论、竞品页面、市场资料与供应候选。报告同时标明来源、可信程度与未知项。",
    foot: "来源可见 · 结论可查 · 未知可补",
    tone: "peach",
  },
] as const;

const method = [
  ["01 / 提问", "定义真实决策", "从关键词、图片或链接背后，识别商家真正想验证的问题和约束。"],
  ["02 / 研究", "联网寻找事实", "检索市场、竞品、用户讨论与供应候选，并记录来源和访问边界。"],
  ["03 / 推理", "回到第一性原理", "区分事实、推断与未知，解释需求为何存在、机会如何成立。"],
  ["04 / 决策", "给出行动边界", "明确是否值得买样、应该补什么证据，以及哪些动作暂时不能做。"],
] as const;

export default function HomePage() {
  return (
    <div className="landing-shell">
      <aside className="landing-rail">
        <Link className="landing-brand" href="/" aria-label="选品猫首页">
          <Gem size={20} strokeWidth={2.4} />
          <strong>选品猫</strong>
        </Link>
        <span className="landing-rail-label">应用</span>
        <nav aria-label="首页导航">
          <Link className="active" href="/"><Home size={16} />首页</Link>
          <Link href="/discover"><Search size={16} />选品工作台</Link>
        </nav>
      </aside>

      <main className="landing-main">
        <header className="landing-utilities">
          <ContactAuthor />
          <Link className="primary" href="/discover">进入工作台 <ArrowRight size={15} /></Link>
        </header>

        <section className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-kicker">选品猫 · 为商家而生</div>
            <h1>选品不该是猜爆款，而是把生意重新想明白</h1>
            <p>我们做选品猫，是因为商家真正缺少的从来不是另一张“可能会卖”的商品榜单，而是一套能持续追问、联网求证，并把市场事实变成经营决策的研究方法。</p>
            <div className="landing-actions">
              <Link className="landing-button dark" href="/discover">开始一次第一性原理选品 <ArrowRight size={15} /></Link>
              <Link className="landing-button light" href="/projects">查看已有报告</Link>
            </div>
          </div>
          <aside className="landing-principle">
            <span className="landing-principle-label">第一性原理 / 01</span>
            <blockquote>先问商家要做什么决定，再决定应该查什么数据。</blockquote>
            <div className="landing-trace">
              <span><b>真实问题</b><em>不是先猜答案</em></span>
              <span><b>真实证据</b><em>不是复制结论</em></span>
              <span><b>行动边界</b><em>不是盲目下注</em></span>
            </div>
          </aside>
        </section>

        <section className="landing-origin">
          <div className="landing-origin-number">00</div>
          <div>
            <div className="landing-kicker">我们为什么做它 / 品牌缘起</div>
            <h2>传统选品工具，常常回答了错误的问题</h2>
            <p>“什么能卖”当然重要，但它不是商家唯一的问题。你还想知道市场刚刚发生了什么、竞品为什么能卖、用户为什么购买或放弃、哪个价格带值得进入，以及买样前还缺什么证据。</p>
            <p>所以我们把选品重新拆回最基本的事实与假设：先理解决策，再寻找证据；先承认未知，再给出建议。</p>
          </div>
        </section>

        <section className="landing-promises">
          <div className="landing-section-head">
            <h2>我们想守住的四个产品承诺</h2>
            <p>不是用更多功能制造复杂，而是让研究更连续、成本更透明、推理更可信、结论更接近真实经营。</p>
          </div>
          <div className="landing-promise-grid">
            {promises.map((item) => (
              <article className={`landing-promise ${item.tone}`} key={item.index}>
                <div className="landing-promise-head"><span>{item.index}</span><small>{item.status}</small></div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <div className="landing-promise-foot">{item.foot}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-method">
          <div className="landing-method-head"><h2>我们如何把一条线索变成决策</h2><span>提问 → 研究 → 推理 → 决策</span></div>
          <div className="landing-method-grid">
            {method.map(([index, title, body]) => (
              <article key={index}><span>{index}</span><h3>{title}</h3><p>{body}</p></article>
            ))}
          </div>
        </section>

        <section className="landing-manifesto">
          <div>
            <span>我们相信</span>
            <h2>好的选品报告，不替商家下注，而是让每一次下注更有依据。</h2>
            <p>选品猫会明确标注来源、可信程度、缺口与报告边界。我们不把竞品证据冒充目标商品事实，也不把方向性机会包装成确定性答案。</p>
          </div>
          <Link className="landing-button lime" href="/discover">开始选品 <ArrowRight size={15} /></Link>
        </section>
      </main>
    </div>
  );
}
