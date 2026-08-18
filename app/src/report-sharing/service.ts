import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const shareRecordSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  runId: z.string().regex(/^[A-Za-z0-9_-]+$/),
  discoveryId: z.string().regex(/^discovery-[a-z0-9-]+$/),
  product: z.string().min(1),
  createdAt: z.iso.datetime(),
  reportPath: z.string().min(1),
});

const shareIndexSchema = z.object({
  schemaVersion: z.literal("1.0"),
  records: z.array(shareRecordSchema),
});

export type ShareRecord = z.infer<typeof shareRecordSchema>;

const shareRoot = path.join(process.cwd(), "output", "share");
const shareIndexPath = path.join(shareRoot, "index.json");

const readIndex = async () => {
  try {
    return shareIndexSchema.parse(JSON.parse(await readFile(shareIndexPath, "utf8")));
  } catch {
    return { schemaVersion: "1.0" as const, records: [] };
  }
};

export const publicShareOrigin = (): string => {
  const configured = process.env.PUBLIC_SHARE_ORIGIN?.trim() ?? process.env.NEXT_PUBLIC_SHARE_ORIGIN?.trim();
  return (configured ?? "https://xuanpinmao.cn").replace(/\/$/, "");
};

export const createReportShare = async (input: {
  runId: string;
  discoveryId: string;
  product: string;
  reportPath: string;
}): Promise<{ record: ShareRecord; shareUrl: string }> => {
  const index = await readIndex();
  const existing = index.records.find((record) => record.runId === input.runId && record.reportPath === input.reportPath);
  if (existing) return { record: existing, shareUrl: `${publicShareOrigin()}/share/${existing.token}` };
  const token = randomBytes(18).toString("base64url");
  const record = shareRecordSchema.parse({ ...input, token, createdAt: new Date().toISOString() });
  await mkdir(shareRoot, { recursive: true });
  await writeFile(shareIndexPath, `${JSON.stringify({ ...index, records: [...index.records, record] }, null, 2)}\n`, "utf8");
  return { record, shareUrl: `${publicShareOrigin()}/share/${token}` };
};

export const readReportShare = async (token: string): Promise<ShareRecord | null> => {
  const record = (await readIndex()).records.find((item) => item.token === token);
  return record ?? null;
};
