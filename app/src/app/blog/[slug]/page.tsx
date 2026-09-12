import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock3 } from "lucide-react";
import { blogPosts, getBlogPost } from "@/blog/posts";
import { SiteTopNavigation } from "../../site-top-navigation";

type BlogArticlePageProps = { params: Promise<{ slug: string }> };

export const generateStaticParams = () => blogPosts.map((post) => ({ slug: post.slug }));

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const post = getBlogPost((await params).slug);
  return post ? { title: `${post.title}｜选品猫`, description: post.excerpt } : {};
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const post = getBlogPost((await params).slug);
  if (!post) notFound();
  const related = blogPosts.filter((item) => item.slug !== post.slug).slice(0, 2);

  return (
    <div className="landing-shell">
      <SiteTopNavigation active="blog" actions={<Link className="primary" href="/discover">开始选品 <ArrowRight size={15} /></Link>} />
      <main className={`blog-article-page tone-${post.accent}`}>
        <Link className="blog-back-link" href="/blog"><ArrowLeft size={15} />返回文章列表</Link>
        <header className="blog-article-hero">
          <div className="blog-article-meta"><span>{post.category}</span><span><Clock3 size={14} />{post.readingMinutes} 分钟阅读</span><time>{post.publishedAt}</time></div>
          <h1>{post.title}</h1>
          <p>{post.excerpt}</p>
          <dl><div><dt>适合谁</dt><dd>{post.audience}</dd></div><div><dt>读完得到</dt><dd>{post.outcome}</dd></div></dl>
        </header>

        <div className="blog-article-layout">
          <aside className="blog-article-toc">
            <span>本文目录</span>
            <ol>{post.sections.map((section, index) => <li key={section.heading}><a href={`#section-${index + 1}`}>{String(index + 1).padStart(2, "0")} {section.heading}</a></li>)}</ol>
          </aside>
          <article className="blog-article-body">
            {post.sections.map((section, index) => (
              <section id={`section-${index + 1}`} key={section.heading}>
                <header><span>{String(index + 1).padStart(2, "0")}</span><h2>{section.heading}</h2></header>
                {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
                {section.callout ? <aside className={`blog-callout callout-${section.callout.label}`}><b>{section.callout.label}</b><p>{section.callout.text}</p></aside> : null}
              </section>
            ))}
          </article>
        </div>

        <section className="blog-related">
          <header><span>继续阅读</span><h2>下一篇可以从这里开始</h2></header>
          <div>{related.map((item) => <Link href={`/blog/${item.slug}`} key={item.slug}><span>{item.category}</span><b>{item.title}</b><small>{item.readingMinutes} 分钟阅读 <ArrowRight size={14} /></small></Link>)}</div>
        </section>
      </main>
    </div>
  );
}
