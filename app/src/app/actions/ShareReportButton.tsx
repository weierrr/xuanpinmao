"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";

type ShareResult = { shareUrl: string; token: string; createdAt: string };

export function ShareReportButton({ runId, shareUrl }: Readonly<{ runId: string; shareUrl?: string }>) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ShareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const share = async () => {
    setPending(true);
    setError(null);
    try {
      if (shareUrl) {
        const directResult = { shareUrl, token: "public-example", createdAt: new Date().toISOString() };
        setResult(directResult);
        try { await navigator.clipboard.writeText(shareUrl); } catch { /* Clipboard permissions are optional. */ }
        return;
      }
      const response = await fetch(`/api/research/${encodeURIComponent(runId)}/share`, { method: "POST" });
      const payload = await response.json() as ShareResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "分享链接创建失败");
      setResult(payload);
      try { await navigator.clipboard.writeText(payload.shareUrl); } catch { /* Clipboard permissions are optional. */ }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "分享链接创建失败");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="report-share-action">
      <button className="button secondary-button" disabled={pending} onClick={share} type="button">
        {pending ? <Share2 className="share-spin" size={16} /> : result ? <Check size={16} /> : <Share2 size={16} />}
        {pending ? "生成分享链接…" : result ? "已复制分享链接" : "一键分享报告"}
      </button>
      {result ? (
        <div className="report-share-result" role="status">
          <input aria-label="报告分享链接" readOnly value={result.shareUrl} />
          <button aria-label="复制报告分享链接" onClick={() => navigator.clipboard.writeText(result.shareUrl)} title="复制链接" type="button"><Copy size={15} /></button>
        </div>
      ) : null}
      {error ? <small className="report-share-error">{error}</small> : null}
    </div>
  );
}
