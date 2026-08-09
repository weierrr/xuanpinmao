# Codex Usage

## 1. Open The Project

Open the extracted `agent-package` directory as a Codex workspace. Windows PowerShell, Windows cmd, macOS and Linux all use `npm install`, `npm run setup` and `npm run doctor`. No manual environment-variable command is needed. No DeepSeek API Key or OpenAI API Key is required.

## 2. Enable web-access

Install or enable the `web-access` Skill in the recipient's own Codex environment. The project cannot install it with npm and cannot call it as a Node.js SDK. `npm run doctor` checks common local Codex skill paths only. A local-path PASS is not final proof of capability; if those paths are unavailable, Doctor emits a WARNING without failing required project checks. A successful real Smoke Test in Codex is always the final readiness check.

## 3. Start The Workbench

```bash
npm run dev
```

Open `http://localhost:3000`. Existing T21 pages contain frozen regression data and must not be described as a new live result.

## 4. Create A New Live Research Run

Ask Codex to use the template in `docs/prompts/live-web-research.md`, or initialize directly:

```bash
npm run research:live -- --product "PRODUCT NAME" --market US --competitor https://example.com/ --audience "TARGET AUDIENCE"
```

This creates a unique empty Evidence Package. It does not perform web access by itself.

## 5. Run The Smoke Test In Codex

In the same Codex task, instruct Codex to load `web-access`, read the new `research_plan.json`, collect only public evidence, save traceable snapshots, and keep unknown facts unresolved. Do not copy Source or Claim records from T21 fixtures, old Evidence Packages or sample reports.

Then run:

```bash
npm run research:validate -- --package output/research/<research-run-id>
npm run research:live -- --package output/research/<research-run-id> --finalize
npm run research:import -- --package output/research/<research-run-id>
```

## 6. Build The First-Principles Opportunity Bundle

After Atomic Claims are complete, ask Codex to continue the current Run:

```text
基于当前 Run 的真实 Evidence 和 Atomic Claims，执行第一性原理机会重构：
剥离产品名词，重述用户问题，区分事实/假设/未知，拆解原子需求和供给，
识别硬/软/伪约束，形成 2-4 个机会组合，并设计 7-14 天最低成本验证计划。
不得解锁缺少正式证据的 Listing 或 Ad Test。
```

Codex then runs:

```bash
npm run workbench -- prepare-first-principles --current --json
npm run workbench -- validate-first-principles --current --file output/codex-native/<run-id>/first-principles-bundle.json --json
npm run workbench -- import-first-principles --current --file output/codex-native/<run-id>/first-principles-bundle.json --json
npm run workbench -- first-principles-summary --current --format markdown
npm run workbench -- pre-sample-brief --current --json
npm run workbench -- finalize --current --json
```

The project does not call an external model API. Codex reads the generated task and writes the Bundle directly. All Claim IDs must belong to the current Run.

Before generating the seller Brief, Codex must create:

```text
output/codex-native/<run-id>/seller-brief-localization.json
```

This Run-isolated file maps the validated Evidence Package and First-Principles Bundle into concise Simplified Chinese. Its schema is defined in `src/pre-sample/localization.ts`. The mapping must preserve meaning and uncertainty without adding facts. The Brief command rejects missing validation-type mappings and seller output that leaks internal IDs, gate states, or untranslated experiment type names.

## 7. Review Results

- Pre-Sample Decision Brief: `http://localhost:3000/research/<research-run-id>/brief`
- Advanced Audit Workbench: `http://localhost:3000/research/<research-run-id>`
- First Principles: `http://localhost:3000/research/<research-run-id>/first-principles`
- Commercial Intelligence: `http://localhost:3000/research/<research-run-id>/commercial-intelligence`
- Decision Boundary: `http://localhost:3000/research/<research-run-id>/decision`
- HTML report: `http://localhost:3000/research/<research-run-id>/report`
- Evidence Package: `output/research/<research-run-id>/`
- First-Principles Artifact: `output/codex-native/<research-run-id>/`

The Smoke Test passes only when sources are newly accessed, snapshots are traceable, Claim-Source mapping errors are zero, and fixture data is not presented as live evidence. An honest `HOLD_SUPPLY` or `REJECT` is a valid result.
