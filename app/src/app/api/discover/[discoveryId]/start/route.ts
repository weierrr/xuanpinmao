import { NextResponse } from "next/server";
import { startLiveResearchForDiscovery } from "@/research/live-research-start";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ discoveryId: string }> },
) {
  const { discoveryId } = await params;
  if (!/^discovery-[a-z0-9-]+$/.test(discoveryId)) {
    return NextResponse.json({ error: "Invalid discovery id" }, { status: 400 });
  }
  try {
    return NextResponse.json(await startLiveResearchForDiscovery(discoveryId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start research" }, { status: 500 });
  }
}
