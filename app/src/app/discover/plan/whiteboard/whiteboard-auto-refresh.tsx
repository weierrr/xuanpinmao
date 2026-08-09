"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ResearchWhiteboard } from "@/research-whiteboard/types";

export function WhiteboardAutoRefresh({ status }: Readonly<{ status: ResearchWhiteboard["status"] }>) {
  const router = useRouter();

  useEffect(() => {
    if (status === "completed" || status === "blocked") return;
    const timer = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [router, status]);

  return null;
}
