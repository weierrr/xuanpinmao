import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/infrastructure/prisma";
import { productNameZh, statusZh } from "@/presentation/zh";
import { readPendingRuns } from "@/research/pending-runs";
import { readSupersededRunIds } from "@/research/superseded-runs";
import { WorkbenchShell } from "../workbench-shell";

export const metadata: Metadata = {
  title: "选品记录｜选品猫",
  description: "查看运行中、待补证和已完成的选品研究。",
};

export default async function ProjectsPage() {
  const allProjects = await prisma.project.findMany({
    include: {
      researchRuns: {
        include: { decision: true },
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const knownRunIds = new Set(
    (await prisma.researchRun.findMany({ select: { id: true } })).map((run) => run.id),
  );
  const supersededRunIds = await readSupersededRunIds();
  const projects = allProjects.filter((project) => (
    !project.researchRuns.some((run) => supersededRunIds.has(run.id))
  ));
  const pendingRuns = await readPendingRuns(knownRunIds, { excludedRunIds: supersededRunIds });
  const totalRecords = projects.length + pendingRuns.length;

  return (
    <WorkbenchShell active="projects">
      <section className="workspace-records-heading">
        <div>
          <span>RESEARCH ARCHIVE / 选品档案</span>
          <h2>全部选品记录</h2>
        </div>
        <p>运行中、待补证和已完成的研究都会保留在这里，共 <strong>{totalRecords}</strong> 条。</p>
      </section>

      <div className="workspace-record-list">
        {projects.map((project) => {
          const run = project.researchRuns[0];
          const openHref = run?.id.startsWith("research-run-")
            ? `/research/${run.id}/report`
            : `/projects/${project.id}`;
          return (
            <article className="workspace-record-card" key={project.id}>
              <div className="workspace-record-title">
                <span>{project.mode === "fixture" ? "冻结样例" : "选品研究"}</span>
                <h3>{productNameZh(project.name)}</h3>
                <p>{run?.id ?? project.id}</p>
              </div>
              <dl>
                <div><dt>目标市场</dt><dd>{project.targetMarket}</dd></div>
                <div><dt>当前阶段</dt><dd>{run ? statusZh(run.status) : statusZh(project.status)}</dd></div>
                <div><dt>正式状态</dt><dd>{run?.decision?.formalStatus ? statusZh(run.decision.formalStatus) : "尚未形成"}</dd></div>
                <div><dt>最近更新</dt><dd>{project.updatedAt.toLocaleDateString("zh-CN")}</dd></div>
              </dl>
              <Link href={openHref}>{run?.decision ? "查看报告 →" : "查看进度 →"}</Link>
            </article>
          );
        })}

        {pendingRuns.map((run) => (
          <article className="workspace-record-card pending" key={run.runId}>
            <div className="workspace-record-title">
              <span>待开始研究</span>
              <h3>{run.productName}</h3>
              <p>{run.runId}</p>
            </div>
            <dl>
              <div><dt>目标市场</dt><dd>{run.targetMarket}</dd></div>
              <div><dt>当前阶段</dt><dd>已建立证据包</dd></div>
              <div><dt>正式状态</dt><dd>尚未形成</dd></div>
              <div><dt>创建时间</dt><dd>{new Date(run.createdAt).toLocaleDateString("zh-CN")}</dd></div>
            </dl>
            <Link href={`/research/${run.runId}/setup`}>开始研究 →</Link>
          </article>
        ))}

        {totalRecords === 0 ? (
          <div className="workspace-record-empty">
            <h3>还没有选品记录</h3>
            <p>从一个关键词、图片或商品链接开始第一次研究。</p>
            <Link href="/discover">开始发现 →</Link>
          </div>
        ) : null}
      </div>
    </WorkbenchShell>
  );
}
