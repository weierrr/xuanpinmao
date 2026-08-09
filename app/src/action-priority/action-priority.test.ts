import { describe, expect, it } from "vitest";
import { buildRunReport } from "../report/service";
import { unifiedActionQueueSchema } from "./types";
import { validateUnifiedActionQueue } from "./validation";

const runId = "research-run-3d-yoga-pants-28f8bff32ab5-us";

describe("统一行动优先级", () => {
  it("全报告只有一个第一步，并且来自当前瑜伽裤主线", async () => {
    const report = await buildRunReport(runId);
    const queue = report.unifiedActionQueue;
    const allActions = [...queue.mainline, ...queue.exploration];
    const globalFirst = allActions.filter((action) => action.role === "GLOBAL_FIRST");

    expect(globalFirst).toHaveLength(1);
    expect(globalFirst[0].lane).toBe("current_product");
    expect(globalFirst[0].status).toBe("READY");
    expect(globalFirst[0].dependencyIds).toEqual([]);
    expect(queue.globalFirstActionId).toBe(globalFirst[0].id);
    expect(validateUnifiedActionQueue(queue).valid).toBe(true);
  });

  it("视觉盲测并入样品阶段，不再成为第一步", async () => {
    const report = await buildRunReport(runId);
    const queue = report.unifiedActionQueue;
    const sampleAction = queue.mainline.find((action) => action.typeLabel === "样品验证");

    expect(queue.mainline[0].embeddedChecks).toEqual([]);
    expect(sampleAction?.embeddedChecks.map((check) => check.label)).toContain("同光线、同姿势的视觉盲测");
    expect(sampleAction?.status).toBe("BLOCKED");
  });

  it("相邻机会只能处于探索支线，不能覆盖主线", async () => {
    const report = await buildRunReport(runId);
    const queue = report.unifiedActionQueue;

    expect(queue.exploration).toHaveLength(3);
    expect(queue.exploration.every((action) => action.lane === "adjacent_exploration")).toBe(true);
    expect(queue.exploration.every((action) => action.role !== "GLOBAL_FIRST")).toBe(true);
    expect(queue.exploration.every((action) => action.status !== "READY")).toBe(true);
  });

  it("验证器拒绝探索支线冒充全局第一步", async () => {
    const report = await buildRunReport(runId);
    const queue = report.unifiedActionQueue;
    const invalid = {
      ...queue,
      globalFirstActionId: queue.exploration[0].id,
      mainline: queue.mainline.map((action, index) => index === 0 ? { ...action, role: "MAINLINE_NEXT" as const } : action),
      exploration: queue.exploration.map((action, index) => index === 0 ? {
        ...action,
        role: "GLOBAL_FIRST" as const,
        status: "READY" as const,
      } : action),
    };

    expect(unifiedActionQueueSchema.safeParse(invalid).success).toBe(false);
  });
});
