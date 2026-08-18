import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { evidenceUpdatePaths, readEvidenceUpdateRegistry } from "./service";
import {
  evidenceAnalysisDiffSchema,
  evidenceAnalysisSnapshotSchema,
  registeredEvidenceBatchSchema,
  type EvidenceAnalysisDiff,
  type EvidenceAnalysisSnapshot,
  type EvidenceUpdateChapterId,
  type RegisteredEvidenceBatch,
} from "./types";

const themeLabels: Record<string, string> = {
  "fit and sizing": "版型与尺码",
  "opacity and squat-proof performance": "不透与深蹲表现",
  "scrunch seam durability": "提臀缝耐久性",
  "fabric durability": "面料耐久性",
  "overall product experience": "整体产品体验",
  "contour and appearance": "塑形与外观",
  "comfort and handfeel": "舒适度与手感",
  "waistband stability": "腰头稳定性",
  "scrunch discomfort": "提臀缝不适",
  "anticipated discomfort": "预期不适",
  "constant adjustment": "反复调整",
  "length inconsistency": "裤长不一致",
  "overly visible styling": "后缝过于明显",
  "compression and support": "压缩与支撑",
  "color consistency": "颜色一致性",
  "breathability and sweat": "透气与排汗",
  "returns and service": "退换与服务",
  "comfort and confidence": "舒适与自信",
  "individual fit preference": "个人版型偏好",
  "scrunch comfort varies": "提臀缝舒适度因人而异",
  "garment-layer workaround": "叠穿规避方案",
  "hidden scrunch": "隐藏式提臀缝",
  "intermediate inseam": "中间裤长需求",
  "grading changed over time": "尺码版型随批次变化",
  "claim-and-use-boundary": "宣称与使用边界",
  "clean-versus-disinfect-boundary": "清洁与消毒边界",
  "daily-cleaning-performance": "日常清洁表现",
  "daily-versus-deep-clean": "日常维护与深度清洁分层",
  "hardware-and-service": "瓶器可靠性与售后",
  "packaging-leakage": "包装密封与运输泄漏",
  "refill-and-spray-convenience": "补充与喷雾便利",
  "refill-convenience": "补充便利",
  "scent-and-perceived-value": "气味与感知价值",
  "scent-context-fit": "气味与使用场景适配",
  "spray-and-grease-performance": "喷雾与去油表现",
  "task-performance-and-scent-fit": "任务表现与气味适配",
  "task-specific-dilution": "任务化稀释说明",
  "surface-compatibility": "材质兼容边界",
  "setup-and-surface-instructions": "启动步骤与适用表面",
  "nozzle-lifecycle-and-service": "喷头寿命与备件服务",
};

const labelFor = (theme: string): string => themeLabels[theme] ?? theme;
const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const atomicWriteJson = async (file: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${Date.now()}.tmp`;
  await writeFile(temporary, json(value), "utf8");
  await rename(temporary, file);
};

const readBatch = async (runId: string, batchId: string, root: string): Promise<RegisteredEvidenceBatch> =>
  registeredEvidenceBatchSchema.parse(JSON.parse(await readFile(path.join(evidenceUpdatePaths(runId, root).batches, `${batchId}.json`), "utf8")));

const customerRecords = (batches: RegisteredEvidenceBatch[]) =>
  batches.flatMap((batch) => batch.records).filter((record) => record.evidenceType === "customer_observation" && record.status === "active");

const proofForTheme = (theme: string): string => {
  if (/claim|disinfect/iu.test(theme)) return "法规复核后的宣称矩阵、标签原文与任务边界测试";
  if (/surface|dilution|setup/iu.test(theme)) return "按材质、浓度和步骤执行的同条件任务测试";
  if (/scent/iu.test(theme)) return "按厨房和浴室场景分开的盲测与耐受反馈";
  if (/hardware|nozzle|leak/iu.test(theme)) return "喷头循环、跌落密封、运输振动和替换成本测试";
  if (/performance|deep-clean|grease/iu.test(theme)) return "标准污渍、接触时间和擦拭次数对照";
  if (/refill|spray/iu.test(theme)) return "补充耗时、喷幅一致性和误操作率测试";
  if (/fit|sizing|length/iu.test(theme)) return "尺码表、不同身高体型试穿和裤长实测";
  if (/opacity|squat/iu.test(theme)) return "同光线深蹲与拉伸防透测试";
  if (/scrunch|seam|durability|fabric/iu.test(theme)) return "缝线拉伸、重复穿洗和耐久对照";
  if (/contour|appearance|visible/iu.test(theme)) return "同侧光、同姿势、未经修图的轮廓对照";
  if (/waist|adjustment/iu.test(theme)) return "动作中腰头位移与反复调整次数";
  return "目标样品、同条件任务对照和目标用户复测";
};

const productActionForTheme = (theme: string): string => {
  if (/claim|disinfect/iu.test(theme)) return "把清洁、去污与消毒宣称边界写进产品定义和标签门禁";
  if (/surface|dilution|setup/iu.test(theme)) return "把材质适配、稀释比例和启动步骤做成可扫描的任务地图";
  if (/scent/iu.test(theme)) return "按厨房和浴室分别验证气味，并保留无香或低气味路径";
  if (/hardware|nozzle|leak/iu.test(theme)) return "把喷头寿命、密封运输和备件成本设为 P0 验收项";
  if (/performance|deep-clean|grease/iu.test(theme)) return "分开定义日常维护与深度清洁的可测性能门槛";
  if (/refill|spray/iu.test(theme)) return "降低补充和喷雾操作负担，并量化耗时与误操作";
  if (/fit|sizing|length/iu.test(theme)) return "把尺码、裤长和版型可预测性设为产品定义第一优先级";
  if (/opacity|squat/iu.test(theme)) return "把防透和深蹲表现设为不可妥协的 P0 指标";
  if (/scrunch discomfort|scrunch seam|visible styling/iu.test(theme)) return "降低提臀缝存在感，并同时验证舒适与耐久";
  if (/fabric durability/iu.test(theme)) return "提高面料与缝线耐久，增加重复穿洗验证";
  if (/contour|appearance/iu.test(theme)) return "保留自然轮廓方向，用结构实现而非夸张视觉语言";
  if (/waist|adjustment/iu.test(theme)) return "提高腰头稳定性，减少运动和日常中的反复调整";
  return `围绕“${labelFor(theme)}”定义可测量的样品指标`;
};

export const buildEvidenceAnalysisSnapshot = ({
  runId,
  registryVersion,
  batches,
  generatedAt,
}: {
  runId: string;
  registryVersion: number;
  batches: RegisteredEvidenceBatch[];
  generatedAt: string;
}): EvidenceAnalysisSnapshot => {
  const records = customerRecords(batches);
  const themeCounts = new Map<string, { count: number; negativeOrNeutral: number; positiveOrCounter: number }>();
  let negativeOrNeutral = 0;
  let positiveOrCounter = 0;
  let unknownSentiment = 0;
  const platforms = new Set<string>();
  const sourceFamilies = new Set<string>();
  for (const record of records) {
    const theme = record.themes[0] ?? "unknown";
    const sentiment = record.themes.find((item) => ["negative", "neutral", "positive", "mixed"].includes(item));
    const observationType = record.themes.find((item) => ["positive_evidence", "counterevidence"].includes(item));
    const negative = sentiment === "negative" || sentiment === "neutral" || sentiment === "mixed";
    const positive = sentiment === "positive" || Boolean(observationType);
    if (negative) negativeOrNeutral += 1;
    if (positive) positiveOrCounter += 1;
    if (!sentiment) unknownSentiment += 1;
    const prior = themeCounts.get(theme) ?? { count: 0, negativeOrNeutral: 0, positiveOrCounter: 0 };
    themeCounts.set(theme, {
      count: prior.count + 1,
      negativeOrNeutral: prior.negativeOrNeutral + (negative ? 1 : 0),
      positiveOrCounter: prior.positiveOrCounter + (positive ? 1 : 0),
    });
    for (const ref of record.entityRefs) {
      if (ref.kind === "platform") platforms.add(ref.key);
      if (ref.kind === "other" && ref.key.startsWith("source-family:")) sourceFamilies.add(ref.key);
    }
  }
  const topThemes = [...themeCounts.entries()]
    .map(([theme, value]) => ({ theme, label: labelFor(theme), ...value, share: records.length ? value.count / records.length : 0 }))
    .sort((left, right) => right.count - left.count || left.theme.localeCompare(right.theme))
    .slice(0, 10);
  const topThree = topThemes.slice(0, 3);
  const customer = records.length === 0
    ? "尚未登记可用于重算的评论级用户证据。"
    : `当前 ${records.length} 条有界用户观察最集中在${topThree.map((item) => `“${item.label}”`).join("、")}；这些频次只描述当前语料，不代表市场总体发生率。`;
  const productActions = [...new Set(topThree.map((item) => productActionForTheme(item.theme)))];
  const proofGroups = new Map<string, string[]>();
  for (const item of topThree) {
    const proof = proofForTheme(item.theme);
    proofGroups.set(proof, [...(proofGroups.get(proof) ?? []), item.label]);
  }
  const marketingProofs = [...proofGroups.entries()].map(([proof, labels]) => `“${labels.join(" / ")}”对应的${proof}`);
  const product = topThree.length === 0
    ? "暂不生成产品方向，等待评论级证据。"
    : productActions.join("；") + "。";
  const marketing = topThree.length === 0
    ? "暂不生成营销方向，等待评论级证据。"
    : `营销表达应优先证明${marketingProofs.join("、")}，不得把竞品评论改写成目标样品功效。`;
  const confidence = records.length >= 300 && platforms.size >= 3
    ? "HIGH"
    : records.length >= 80 && platforms.size >= 2
      ? "MEDIUM"
      : records.length > 0
        ? "LOW"
        : "INSUFFICIENT";
  const decision = confidence === "INSUFFICIENT"
    ? "当前没有足够用户证据，不能进入产品选择。"
    : confidence === "LOW"
      ? "可以继续定义假设与补充研究，但仍不应采购、上架或投放。"
      : "用户证据足以支持进入样品验证，但供应、成本、合规和目标样品表现仍未通过，不能直接上架或投放。";
  return evidenceAnalysisSnapshotSchema.parse({
    schemaVersion: "1.0",
    runId,
    registryVersion,
    generatedAt,
    includedBatchIds: batches.map((batch) => batch.batchId),
    coverage: {
      customerRecords: records.length,
      sourceFamilies: sourceFamilies.size,
      platforms: platforms.size,
      negativeOrNeutral,
      positiveOrCounter,
      unknownSentiment,
    },
    topThemes,
    conclusions: { customer, product, marketing, decision },
    confidence,
    boundary: "自动重算只基于已登记且状态有效的评论级证据。它可以更新研究结论草案，但不能自动解除采购、上架、广告或功效宣称门禁。",
  });
};

const conclusionDiffs = (
  before: EvidenceAnalysisSnapshot,
  after: EvidenceAnalysisSnapshot,
  reason: string,
): EvidenceAnalysisDiff["conclusions"] => {
  const mappings: Array<{ key: keyof EvidenceAnalysisSnapshot["conclusions"]; chapterId: EvidenceUpdateChapterId; label: string }> = [
    { key: "customer", chapterId: "customers", label: "用户判断" },
    { key: "product", chapterId: "positioning", label: "产品方向" },
    { key: "marketing", chapterId: "marketing", label: "营销表达" },
    { key: "decision", chapterId: "decision", label: "行动边界" },
  ];
  return mappings.map(({ key, chapterId, label }) => ({
    chapterId,
    label,
    before: before.conclusions[key],
    after: after.conclusions[key],
    reason,
    status: before.conclusions[key] === after.conclusions[key] ? "unchanged" : "changed",
  }));
};

export const buildEvidenceAnalysisDiff = ({
  batch,
  before,
  after,
  generatedAt,
}: {
  batch: RegisteredEvidenceBatch;
  before: EvidenceAnalysisSnapshot;
  after: EvidenceAnalysisSnapshot;
  generatedAt: string;
}): EvidenceAnalysisDiff => {
  const metricFields = ["customerRecords", "sourceFamilies", "platforms", "negativeOrNeutral", "positiveOrCounter"] as const;
  const metrics = metricFields.flatMap((field) => before.coverage[field] === after.coverage[field] ? [] : [{
    field,
    before: before.coverage[field],
    after: after.coverage[field],
    delta: after.coverage[field] - before.coverage[field],
  }]);
  const beforeThemes = new Map(before.topThemes.map((theme) => [theme.theme, theme]));
  const afterThemes = new Map(after.topThemes.map((theme) => [theme.theme, theme]));
  const topThemeChanges = [...new Set([...beforeThemes.keys(), ...afterThemes.keys()])]
    .map((theme) => ({
      theme,
      label: labelFor(theme),
      beforeCount: beforeThemes.get(theme)?.count ?? 0,
      afterCount: afterThemes.get(theme)?.count ?? 0,
      delta: (afterThemes.get(theme)?.count ?? 0) - (beforeThemes.get(theme)?.count ?? 0),
    }))
    .filter((item) => item.delta !== 0)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 10);
  const reason = `批次 ${batch.batchId} 接受 ${batch.counts.accepted} 条/项、识别 ${batch.counts.duplicates} 条重复，系统据此重新计算有界用户证据。`;
  const conclusions = conclusionDiffs(before, after, reason);
  const changed = metrics.length > 0 || topThemeChanges.length > 0 || conclusions.some((item) => item.status === "changed");
  const affectedChapterIds = [...new Set([
    ...batch.impactedChapterIds,
    ...conclusions.filter((item) => item.status === "changed").map((item) => item.chapterId),
  ])];
  return evidenceAnalysisDiffSchema.parse({
    schemaVersion: "1.0",
    runId: after.runId,
    batchId: batch.batchId,
    fromVersion: before.registryVersion,
    toVersion: after.registryVersion,
    generatedAt,
    changed,
    affectedChapterIds,
    metrics,
    conclusions,
    topThemeChanges,
    boundary: "差异记录展示数据和结论草案如何变化；任何正式结论仍需经过一致性检查、证据边界审核和人工发布。",
  });
};

export type EvidenceAnalysisBundle = {
  snapshot: EvidenceAnalysisSnapshot;
  latestDiff: EvidenceAnalysisDiff | null;
  latestMeaningfulDiff: EvidenceAnalysisDiff | null;
};

export const recomputeEvidenceAnalysis = async ({
  runId,
  root = process.cwd(),
  now = new Date().toISOString(),
}: {
  runId: string;
  root?: string;
  now?: string;
}): Promise<EvidenceAnalysisBundle> => {
  const registry = await readEvidenceUpdateRegistry(runId, root);
  const batches = await Promise.all(registry.batches.map((batch) => readBatch(runId, batch.batchId, root)));
  const snapshots: EvidenceAnalysisSnapshot[] = [];
  const diffs: EvidenceAnalysisDiff[] = [];
  for (let version = 0; version <= registry.version; version += 1) {
    const snapshot = buildEvidenceAnalysisSnapshot({ runId, registryVersion: version, batches: batches.slice(0, version), generatedAt: now });
    snapshots.push(snapshot);
    await atomicWriteJson(path.join(evidenceUpdatePaths(runId, root).analysis, `snapshot-v${String(version).padStart(4, "0")}.json`), snapshot);
    if (version > 0) {
      const diff = buildEvidenceAnalysisDiff({ batch: batches[version - 1], before: snapshots[version - 1], after: snapshot, generatedAt: now });
      diffs.push(diff);
      await atomicWriteJson(path.join(evidenceUpdatePaths(runId, root).analysis, `diff-v${String(version).padStart(4, "0")}.json`), diff);
    }
  }
  const bundle: EvidenceAnalysisBundle = {
    snapshot: snapshots.at(-1) ?? buildEvidenceAnalysisSnapshot({ runId, registryVersion: 0, batches: [], generatedAt: now }),
    latestDiff: diffs.at(-1) ?? null,
    latestMeaningfulDiff: [...diffs].reverse().find((diff) => diff.changed && diff.conclusions.some((item) => item.status === "changed")) ?? null,
  };
  await atomicWriteJson(path.join(evidenceUpdatePaths(runId, root).analysis, "latest.json"), bundle);
  return bundle;
};

export const readEvidenceAnalysisBundle = async (
  runId: string,
  root = process.cwd(),
): Promise<EvidenceAnalysisBundle | null> => {
  try {
    const payload = JSON.parse(await readFile(path.join(evidenceUpdatePaths(runId, root).analysis, "latest.json"), "utf8")) as EvidenceAnalysisBundle;
    return {
      snapshot: evidenceAnalysisSnapshotSchema.parse(payload.snapshot),
      latestDiff: payload.latestDiff ? evidenceAnalysisDiffSchema.parse(payload.latestDiff) : null,
      latestMeaningfulDiff: payload.latestMeaningfulDiff ? evidenceAnalysisDiffSchema.parse(payload.latestMeaningfulDiff) : null,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};
