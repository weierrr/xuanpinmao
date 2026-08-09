"use client";

import { useState } from "react";
import { Download } from "lucide-react";

type ExportResponse = {
  markdownPath: string;
  htmlPath: string;
  version: number;
};

export function ExportButton({ runId }: Readonly<{ runId: string }>) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ExportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportReport = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/runs/${runId}/export`, { method: "POST" });
      if (!response.ok) {
        throw new Error(`导出失败：${response.status}`);
      }
      const payload = (await response.json()) as ExportResponse;
      setResult(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导出失败");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid">
      <button className="button" disabled={pending} onClick={exportReport} title="导出 Markdown 与 HTML 报告" type="button">
        <Download size={16} />
        {pending ? "导出中" : "导出报告"}
      </button>
      {result ? (
        <div className="callout mono">
          v{result.version} Markdown: {result.markdownPath}
          <br />
          HTML: {result.htmlPath}
        </div>
      ) : null}
      {error ? <div className="callout">{error}</div> : null}
    </div>
  );
}
