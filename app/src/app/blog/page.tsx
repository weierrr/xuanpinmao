import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock3, FileText, MoveRight } from "lucide-react";
import { blogCategories, blogPosts } from "@/blog/posts";
import { SiteTopNavigation } from "../site-top-navigation";

export const metadata: Metadata = {
  title: "选品干货｜选品猫",
  description: "关于跨境选品、用户研究、竞品拆解、供应链和合规验证的实战文章。",
};

const featured = blogPosts.find((post) => post.featured) ?? blogPosts[0];

export default function BlogPage() {
  return (
    <div className="landing-shell">
      <SiteTopNavigation
        active="blog"
        actions={<Link className="primary" href="/discover">开始选品 <ArrowRight size={15} /></Link>}
      />
      <main className="blog-page">
        <header className="blog-index-hero">
          <div>
            <span>选品猫研究手记 / FIELD NOTES</span>
            <h1>少一点“听说能卖”，<br />多一点可验证的判断。</h1>
          </div>
          <aside>
            <b>{String(blogPosts.length).padStart(2, "0")}</b>
            <span>篇实战文章</span>
            <p>把市场、用户、竞品、供应和合规问题，拆成可以核查、可以执行的选品方法。</p>
          </aside>
        </header>

        <nav className="blog-category-strip" aria-label="文章分类">
          <span>全部文章</span>
          {blogCategories.map((category) => <a href={`#${category}`} key={category}>{category}</a>)}
        </nav>

        <section className={`blog-featured tone-${featured.accent}`}>
          <div className="blog-featured-index"><span>本期重点</span><b>01</b><small>RESEARCH NOTE</small></div>
          <div className="blog-featured-copy">
            <span>{featured.category}</span>
            <h2>{featured.title}</h2>
            <p>{featured.excerpt}</p>
            <dl>
              <div><dt>适合谁</dt><dd>{featured.audience}</dd></div>
              <div><dt>读完得到</dt><dd>{featured.outcome}</dd></div>
            </dl>
            <Link href={`/blog/${featured.slug}`}>阅读全文 <ArrowRight size={17} /></Link>
          </div>
        </section>

        <section className="blog-article-index">
          <header><span>文章索引</span><h2>从正在解决的问题开始读</h2></header>
          <div>
            {blogPosts.map((post, index) => (
              <article className={`tone-${post.accent}`} id={post.category} key={post.slug}>
                <span className="blog-card-number">{String(index + 1).padStart(2, "0")}</span>
                <div className="blog-card-copy">
                  <span>{post.category}</span>
                  <h3><Link href={`/blog/${post.slug}`}>{post.title}</Link></h3>
                  <p>{post.excerpt}</p>
                  <footer><span><Clock3 size={14} />{post.readingMinutes} 分钟</span><span><FileText size={14} />{post.outcome}</span></footer>
                </div>
                <Link className="blog-card-arrow" href={`/blog/${post.slug}`} aria-label={`阅读${post.title}`}><MoveRight size={24} /></Link>
              </article>
            ))}
          </div>
        </section>

        <section className="blog-newsletter">
          <div><span>持续更新</span><h2>把一轮真实调研，整理成一篇能直接拿去用的文章。</h2></div>
          <p>后续会继续写类目大盘、评论分析、广告拆解、供应商沟通和买样验证。文章不追热点，优先回答卖家正在做决定时真正卡住的问题。</p>
        </section>
      </main>
    </div>
  );
}
