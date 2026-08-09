import { writeOpportunityDiscoveryPlan } from "../src/opportunity-discovery/service";

const readOption = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const readOptions = (name: string): string[] =>
  process.argv.flatMap((arg, index) => (arg === `--${name}` && process.argv[index + 1] ? [process.argv[index + 1]] : []));

const categoryKeyword = readOption("category");
const targetMarket = readOption("market");
if (!categoryKeyword || !targetMarket) {
  throw new Error('Usage: npm run discovery:plan -- --category "yoga pants" --market US [--audience "US activewear buyers"] [--reference https://example.com]');
}

writeOpportunityDiscoveryPlan({
  categoryKeyword,
  targetMarket,
  targetAudience: readOption("audience"),
  referenceUrls: readOptions("reference"),
}).then((result) => {
  console.log(JSON.stringify(result, null, 2));
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
