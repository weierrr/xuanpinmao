"use client";

import { useFormStatus } from "react-dom";

export function ConfirmResearchButton({ disabled }: Readonly<{ disabled: boolean }>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} aria-live="polite">
      {pending ? "正在建立研究白板…" : "确认并继续研究 →"}
    </button>
  );
}
