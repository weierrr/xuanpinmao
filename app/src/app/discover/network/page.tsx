import type { Metadata } from "next";
import { WorkbenchShell } from "../../workbench-shell";
import { DiscoveryNetworkView } from "@/discovery-network/discovery-network-view";
import { buildCurrentDiscoveryNetwork } from "@/discovery-network/service";

export const metadata: Metadata = {
  title: "人群需求发现网络｜选品猫",
  description: "从商品、人群和使用场景探索有证据边界的相邻选品机会。",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DiscoveryNetworkPage() {
  const network = await buildCurrentDiscoveryNetwork();
  return (
    <WorkbenchShell active="network">
      <DiscoveryNetworkView network={network} />
    </WorkbenchShell>
  );
}
