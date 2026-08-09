import type {
  UnifiedActionQueue,
  UnifiedActionQueueIssue,
  UnifiedActionQueueValidationResult,
} from "./types";

export const validateUnifiedActionQueue = (
  queue: UnifiedActionQueue,
): UnifiedActionQueueValidationResult => {
  const errors: UnifiedActionQueueIssue[] = [];
  const warnings: UnifiedActionQueueIssue[] = [];
  const actions = [...queue.mainline, ...queue.exploration];
  const ids = new Set<string>();

  for (const action of actions) {
    if (ids.has(action.id)) {
      errors.push({ code: "DUPLICATE_ACTION", message: "统一行动队列包含重复任务。", actionId: action.id });
    }
    ids.add(action.id);
    if (action.runId !== queue.runId) {
      errors.push({ code: "RUN_MISMATCH", message: "行动任务必须属于当前报告 Run。", actionId: action.id });
    }
  }

  const globalFirst = actions.filter((action) => action.role === "GLOBAL_FIRST");
  if (globalFirst.length !== 1) {
    errors.push({ code: "GLOBAL_FIRST_COUNT", message: "全报告必须且只能有一个全局第一步。" });
  }
  if (globalFirst[0]?.id !== queue.globalFirstActionId) {
    errors.push({ code: "GLOBAL_FIRST_MISMATCH", message: "全局第一步引用与任务明细不一致。" });
  }

  const mainlineIds = new Set(queue.mainline.map((action) => action.id));
  for (const [index, action] of queue.mainline.entries()) {
    if (action.order !== index + 1) {
      errors.push({ code: "MAINLINE_ORDER", message: "主线任务必须按连续顺序排列。", actionId: action.id });
    }
    for (const dependencyId of action.dependencyIds) {
      const dependencyIndex = queue.mainline.findIndex((item) => item.id === dependencyId);
      if (!mainlineIds.has(dependencyId) || dependencyIndex >= index) {
        errors.push({ code: "INVALID_DEPENDENCY", message: "主线任务只能依赖排在自己之前的主线任务。", actionId: action.id });
      }
    }
    if (index > 0 && action.dependencyIds.length === 0) {
      warnings.push({ code: "MISSING_DEPENDENCY", message: "后续主线任务没有声明前置依赖。", actionId: action.id });
    }
  }

  for (const action of queue.exploration) {
    if (action.role === "GLOBAL_FIRST" || action.status === "READY") {
      errors.push({ code: "EXPLORATION_OVERRIDES_MAINLINE", message: "探索支线不能成为全局第一步或主线就绪任务。", actionId: action.id });
    }
  }

  const metrics = {
    mainlineCount: queue.mainline.length,
    explorationCount: queue.exploration.length,
    readyNowCount: actions.filter((action) => action.status === "READY").length,
    blockedCount: actions.filter((action) => action.status === "BLOCKED").length,
    observeCount: actions.filter((action) => action.status === "OBSERVE").length,
  };
  if (JSON.stringify(metrics) !== JSON.stringify(queue.metrics)) {
    errors.push({ code: "METRICS_MISMATCH", message: "统一行动队列汇总数字与任务明细不一致。" });
  }

  return { valid: errors.length === 0, errors, warnings };
};
