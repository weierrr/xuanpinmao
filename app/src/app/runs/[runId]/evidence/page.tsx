import { notFound } from "next/navigation";
import { attachDerivedClaimIds, validateClaimSourceIntegrity } from "@/domain/claim-source";
import type { ClaimRecord, SourceRecord } from "@/domain/types";
import { prisma } from "@/infrastructure/prisma";
import { Metric, PageHeader } from "../../../components";
import { loadLiveEvidenceCenter } from "@/evidence-center/live-evidence";
import { LiveEvidenceCenterView } from "@/evidence-center/live-evidence-view";

const toSourceRecord = (source: Awaited<ReturnType<typeof prisma.source.findMany>>[number]): SourceRecord => ({
  id: source.id,
  title: source.title,
  url: source.url,
  sourceType: source.sourceType,
  evidenceCarrier: source.evidenceCarrier,
  accessedAt: source.accessedAt,
  accessStatus: source.accessStatus,
  targetEntity: source.targetEntity,
  skuOrVariant: source.skuOrVariant,
  market: source.market,
  notes: source.notes,
});

const toClaimRecord = (claim: Awaited<ReturnType<typeof prisma.claim.findMany>>[number]): ClaimRecord => ({
  id: claim.id,
  atomicClaim: claim.atomicClaim,
  dataNature: claim.dataNature,
  sourceId: claim.sourceId,
  sourceType: claim.sourceType,
  evidenceCarrier: claim.evidenceCarrier,
  sourceLocation: claim.sourceLocation,
  linkSpecificity: claim.linkSpecificity,
  observedAt: claim.observedAt,
  informationNature: claim.informationNature,
  verificationStatus: claim.verificationStatus,
  timeStatus: claim.timeStatus,
  runSpecApplicability: claim.runSpecApplicability,
  dataCompleteness: claim.dataCompleteness,
  decisionUse: claim.decisionUse,
  confidence: claim.confidence,
  inferenceBasis: claim.inferenceBasis,
  missingEvidence: claim.missingEvidence,
  notes: claim.notes,
});

export default async function EvidencePage({ params }: Readonly<{ params: Promise<{ runId: string }> }>) {
  const { runId } = await params;
  const run = await prisma.researchRun.findUnique({
    where: { id: runId },
    include: { decision: true },
  });
  if (!run) {
    notFound();
  }

  const [sourcesRaw, claimsRaw] = await Promise.all([
    prisma.source.findMany({ where: { researchRunId: runId }, orderBy: { id: "asc" } }),
    prisma.claim.findMany({ where: { researchRunId: runId }, orderBy: { id: "asc" } }),
  ]);
  const liveEvidence = await loadLiveEvidenceCenter(runId);
  if (liveEvidence) {
    return (
      <LiveEvidenceCenterView
        runId={runId}
        evidence={liveEvidence}
        persistedSourceCount={sourcesRaw.length}
        persistedClaimCount={claimsRaw.length}
      />
    );
  }
  const sources = sourcesRaw.map(toSourceRecord);
  const claims = claimsRaw.map(toClaimRecord);
  const ledger = attachDerivedClaimIds(sources, claims);
  const integrity = validateClaimSourceIntegrity(sources, claims, ledger);
  const unknowns = claims.filter((claim) => claim.informationNature === "未知" || claim.dataCompleteness === "关键字段缺失");
  const inferences = claims.filter((claim) => claim.informationNature === "模型推断");

  return (
    <>
      <PageHeader title="证据中心" subtitle="来源、结论、未知项、推断、冲突与映射校验" status={run.decision?.formalStatus} />
      <div className="tabs">
        <a href="#sources">来源</a>
        <a href="#claims">结论</a>
        <a href="#unknowns">未知项</a>
        <a href="#inferences">推断</a>
        <a href="#conflicts">冲突</a>
        <a href="#mapping">映射校验</a>
      </div>
      <div className="grid cols-3">
        <Metric label="来源" value={sources.length} />
        <Metric label="结论" value={claims.length} />
        <Metric label="映射错误" value={integrity.mappingMismatchCount} />
      </div>
      <section id="sources" className="card" style={{ marginTop: 16 }}>
        <h2>来源</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>标题</th><th>实体</th><th>SKU</th><th>市场</th><th>派生结论</th></tr></thead>
            <tbody>
              {ledger.map((source) => (
                <tr key={source.id}>
                  <td>{source.id}</td>
                  <td>{source.title}</td>
                  <td>{source.targetEntity}</td>
                  <td>{source.skuOrVariant ?? "未知"}</td>
                  <td>{source.market ?? "未知"}</td>
                  <td className="mono">{source.claimIds.join(";") || "无"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section id="claims" className="card" style={{ marginTop: 16 }}>
        <h2>结论</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>来源</th><th>结论</th><th>验证</th><th>适用性</th><th>决策用途</th><th>置信度</th></tr></thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim.id}>
                  <td>{claim.id}</td>
                  <td>{claim.sourceId}</td>
                  <td>{claim.atomicClaim}</td>
                  <td>{claim.verificationStatus}</td>
                  <td>{claim.runSpecApplicability}</td>
                  <td>{claim.decisionUse}</td>
                  <td>{claim.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <section id="unknowns" className="card">
          <h2>未知项</h2>
          <ul className="list">{unknowns.slice(0, 10).map((claim) => <li key={claim.id}>{claim.id} {claim.atomicClaim}</li>)}</ul>
        </section>
        <section id="inferences" className="card">
          <h2>推断</h2>
          <ul className="list">{inferences.map((claim) => <li key={claim.id}>{claim.id} {claim.atomicClaim}</li>)}</ul>
        </section>
      </div>
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <section id="conflicts" className="card">
          <h2>冲突</h2>
          <p>当前没有已证明同一对象、同一时间、同一指标的直接冲突；价格、重量和DDP属于关系未知或供应链证据不足。</p>
        </section>
        <section id="mapping" className="card">
          <h2>映射校验</h2>
          <p>正向引用：{integrity.forwardReferenceValid ? "有效" : "无效"}</p>
          <p>反向引用：{integrity.reverseReferenceValid ? "有效" : "无效"}</p>
          <p>孤立结论：{integrity.orphanClaimIds.join(", ") || "无"}</p>
          <p>错误登记：{integrity.wrongSourceClaimIds.join(", ") || "无"}</p>
        </section>
      </div>
    </>
  );
}
