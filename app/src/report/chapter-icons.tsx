import {
  Ban,
  Gauge,
  Megaphone,
  Store,
  Target,
  TestTube,
  Users,
  Flag,
  Archive,
  type LucideIcon,
} from "lucide-react";
import type { ReportChapterId } from "./types";

/**
 * One icon per chapter, used in both the sticky rail and the chapter heading so
 * a reader can find a chapter by shape as well as by number.
 */
export const chapterIcons: Record<ReportChapterId | "appendix", LucideIcon> = {
  summary: Flag,
  market: Gauge,
  competitors: Store,
  customers: Users,
  positioning: Target,
  validation: TestTube,
  marketing: Megaphone,
  boundary: Ban,
  appendix: Archive,
};
