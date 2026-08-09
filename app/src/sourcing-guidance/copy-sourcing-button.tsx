"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopySourcingButton({ text }: Readonly<{ text: string }>) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      window.setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("failed");
    }
  };

  return (
    <button className="report-sourcing-copy" type="button" onClick={copy}>
      {state === "copied" ? <Check size={16} /> : <Copy size={16} />}
      <span aria-live="polite">
        {state === "copied" ? "已复制完整寻源包" : state === "failed" ? "复制失败，请展开后手动复制" : "复制完整寻源包"}
      </span>
    </button>
  );
}
