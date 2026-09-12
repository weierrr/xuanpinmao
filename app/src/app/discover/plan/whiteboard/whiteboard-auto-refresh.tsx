"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ResearchWhiteboard } from "@/research-whiteboard/types";

export function WhiteboardAutoRefresh({ status, updatedAt }: Readonly<{ status: ResearchWhiteboard["status"]; updatedAt: string }>) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), status === "completed" || status === "blocked" ? 10000 : 4000);
    return () => window.clearInterval(timer);
  }, [router, status, updatedAt]);

  return null;
}
