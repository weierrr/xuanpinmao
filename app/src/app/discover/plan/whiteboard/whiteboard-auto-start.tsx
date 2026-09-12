"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResearchWhiteboard } from "@/research-whiteboard/types";

export function WhiteboardAutoStart({
  discoveryId,
  status,
  researchRunId,
}: Readonly<{
  discoveryId: string;
  status: ResearchWhiteboard["status"];
  researchRunId?: string;
}>) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [startState, setStartState] = useState<"idle" | "starting" | "failed">("idle");

  useEffect(() => {
    if (status !== "waiting" || researchRunId || startState === "starting") return;
    setStartState("starting");
    void fetch(`/api/discover/${encodeURIComponent(discoveryId)}/start`, { method: "POST" })
      .then((response) => {
        if (!response.ok) throw new Error("start failed");
        router.refresh();
      })
      .catch(() => {
        setStartState("failed");
        router.refresh();
      });
  }, [attempt, discoveryId, researchRunId, router, startState, status]);

  if (status !== "waiting" || researchRunId) return null;
  return (
    <aside className={`research-agent-start-notice state-${startState}`} role="status">
      <span aria-hidden="true" />
      <div>
        <strong>{startState === "failed" ? "研究 Agent 启动失败" : "正在唤醒研究 Agent"}</strong>
        <p>{startState === "failed" ? "白板已经安全保存，可以重新尝试启动，不会创建重复研究任务。" : "市场、用户、竞品、供应和合规五条证据线会在下方逐条亮起。"}</p>
      </div>
      {startState === "failed" ? <button type="button" onClick={() => { setStartState("idle"); setAttempt((value) => value + 1); }}>重新启动</button> : null}
    </aside>
  );
}
