import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Image, Link2, MessageSquareText, PlayCircle, Search } from "lucide-react";
import { SiteTopNavigation } from "../site-top-navigation";

export const metadata: Metadata = {
  title: "使用说明｜选品猫",
  description: "了解如何从研究线索开始，在实时白板中完成一轮可追溯的选品调研。",
};

const steps = [
  {
    number: "01",
    title: "在对话中唤醒选品猫",
    body: "告诉 Codex 你要调研一个新品、类目或竞争方向。选品猫会自动打开工作台，而不是先在聊天里堆一大段问题。",
    note: "例如：帮我研究美国市场的冰箱替换滤芯。",
  },
  {
    number: "02",
    title: "把现有线索一起交给它",
    body: "关键词、商品图片和竞品链接可以同时填写。线索越具体，系统越容易确认你真正想卖的商品以及研究边界。",
    note: "三类线索至少填写一项，不需要三选一。",
  },
  {
    number: "03",
    title: "确认研究对象后再开始",
    body: "系统会先解释它理解的产品、市场、渠道和排除范围。你确认无误后，才会创建独立调研任务并打开实时白板。",
    note: "确认页可以避免关键词歧义导致整轮研究跑偏。",
  },
  {
    number: "04",
    title: "在白板上查看整个过程",
    body: "数据来源、Agent 的检索与采集记录、整理分析、六份报告和执行方案都会持续更新。最终报告仍然留在这张白板上。",
    note: "以后补充评论、价格或 API 数据，可以在原报告基础上生成新版本。",
  },
];

export default function GuidePage() {
  return (
    <div className="landing-shell">
      <SiteTopNavigation
        active="guide"
        actions={<Link className="primary" href="/discover">开始选品 <ArrowRight size={15} /></Link>}
      />
      <main className="guide-page">
        <section className="guide-hero">
          <div>
            <span>使用说明 / 图文版</span>
            <h1>一轮选品调研，<br />从哪里开始？</h1>
            <p>不需要先学习复杂的研究框架。准备好你手上的关键词、图片或竞品链接，然后跟着页面完成确认即可。</p>
          </div>
          <aside>
            <PlayCircle size={42} />
            <strong>演示视频即将加入</strong>
            <p>这一版先保留图文说明。后续录制完整操作演示后，视频会放在这里。</p>
          </aside>
        </section>

        <section className="guide-input-strip">
          <span><Search size={18} /><b>关键词</b><small>类目、产品、痛点或场景</small></span>
          <i>+</i>
          <span><Image size={18} /><b>商品图片</b><small>外观、结构与相似款</small></span>
          <i>+</i>
          <span><Link2 size={18} /><b>竞品链接</b><small>商品页、品牌页或平台页</small></span>
        </section>

        <section className="guide-steps">
          <header><span>完整流程</span><h2>四步完成一轮可追溯调研</h2></header>
          <ol>
            {steps.map((step) => (
              <li key={step.number}>
                <b>{step.number}</b>
                <div><h3>{step.title}</h3><p>{step.body}</p><small><CheckCircle2 size={14} />{step.note}</small></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="guide-chat-example">
          <header><MessageSquareText size={22} /><span>可以直接这样告诉 Codex</span></header>
          <blockquote>“调用选品猫，帮我研究美国 TikTok Shop 的塑形瑜伽裤。我有一个关键词、两张参考图片和三个竞品链接。”</blockquote>
          <Link href="/discover">打开工作台试一试 <ArrowRight size={15} /></Link>
        </section>
      </main>
    </div>
  );
}
