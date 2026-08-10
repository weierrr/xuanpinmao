"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { chapterIcons } from "./chapter-icons";
import { activeChapterAt, type ReportChapterMeta } from "./types";

/**
 * Sticky chapter rail for the long-scroll report.
 *
 * The rail shows the seller-facing decision layers only. Research process and
 * evidence remain reachable through the appendix without competing with the
 * main reading path.
 */
export function ReportNav({
  chapters,
  backHref,
  title,
  subtitle,
}: Readonly<{
  chapters: ReportChapterMeta[];
  backHref: string;
  title: string;
  subtitle: string;
}>) {
  const [activeId, setActiveId] = useState<string>(chapters[0]?.id ?? "");

  useEffect(() => {
    const ids = [...chapters.map((chapter) => chapter.id), "appendix"];

    // Queried on every pass, never cached: this effect can run before the
    // sibling chapter sections are in the DOM, and caching an empty list there
    // would leave the rail stuck on the first chapter forever.
    const readSections = () =>
      ids
        .map((id) => document.getElementById(`chapter-${id}`))
        .filter((section): section is HTMLElement => section !== null);

    // Chapters differ hugely in height (374px to 2400px), which makes
    // "topmost intersecting section" flip to the wrong entry and never reach
    // the short trailing ones. Reading scroll position directly is exact:
    // the active chapter is the last one whose top has passed the reading line.
    const sync = () => {
      const sections = readSections();
      if (sections.length === 0) return;

      // On wide screens the rail sits beside the text; the narrow layout keeps
      // a sticky bar overhead whose height has to be discounted.
      const readingLine = window.matchMedia("(min-width: 1024px)").matches ? 80 : 180;
      const next = activeChapterAt(
        sections.map((section) => ({
          id: section.id.replace("chapter-", ""),
          top: section.getBoundingClientRect().top,
        })),
        readingLine,
        window.innerHeight + window.scrollY >= document.body.scrollHeight - 2,
      );
      if (next) setActiveId(next);
    };

    // Measuring nine offsets is cheap, and reading them synchronously keeps the
    // highlight correct even when rAF is throttled (background/hidden tab).
    const onScroll = sync;

    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    // Chapter offsets move whenever content reflows — fonts finish loading, a
    // <details> opens, a chart lays out. Without this the rail keeps
    // highlighting whatever was correct at first paint.
    const resizeObserver = new ResizeObserver(onScroll);
    resizeObserver.observe(document.body);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      resizeObserver.disconnect();
    };
  }, [chapters]);

  return (
    <aside className="report-chrome">
      <div className="report-chrome-head">
        <Link className="report-back" href={backHref}>
          <ArrowLeft size={16} />
          <span>返回选品猫</span>
        </Link>
        <div className="report-identity">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <nav className="report-rail" aria-label="报告章节">
        {chapters.map((chapter) => {
          const Icon = chapterIcons[chapter.id];
          return (
            <a
              key={chapter.id}
              href={`#chapter-${chapter.id}`}
              className={`report-rail-item ${activeId === chapter.id ? "active" : ""}`}
              aria-current={activeId === chapter.id ? "true" : undefined}
            >
              <span className="report-rail-index">{chapter.index}</span>
              <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
              <span className="report-rail-label">{chapter.label}</span>
            </a>
          );
        })}
        <a
          href="#chapter-appendix"
          className={`report-rail-item ${activeId === "appendix" ? "active" : ""}`}
        >
          <span className="report-rail-index">附</span>
          {(() => { const Icon = chapterIcons.appendix; return <Icon size={15} strokeWidth={1.9} aria-hidden="true" />; })()}
          <span className="report-rail-label">研究与证据附录</span>
        </a>
      </nav>
    </aside>
  );
}
