import { writeMarketingTranslationForRun } from "../src/marketing-translation/service";

const readOption = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const runId = readOption("run");
if (!runId || !/^[a-z0-9_-]+$/i.test(runId)) {
  throw new Error("Usage: npm run marketing:generate -- --run <research-run-id>");
}

writeMarketingTranslationForRun(runId)
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
