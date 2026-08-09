---
name: open-xuanpinmao
description: Open, develop, and use the local Xuanpinmao cross-border product research system. Use when the user mentions 选品猫, wants to research a new product or category, confirm what a keyword means before research, create an auditable Research Run, generate a traceable whiteboard-style seller report, or append new evidence and update an existing report.
---

# 选品猫

Resolve the active Xuanpinmao application before acting. Use the first valid directory below that contains `package.json`, `src/app`, and the landing-page text `选品不该是猜爆款，而是把生意重新想明白`:

1. `XUANPINMAO_PROJECT_ROOT` when explicitly configured.
2. The current workspace or its `app/` child.
3. A nearby `cross-border-product-opportunity-agent/` developer workspace only when it independently passes the project checks below.
4. The `app/` child of the configured `xuanpinmao` Git marketplace root returned by `codex plugin marketplace list`.

Never use an installed plugin cache as the writable application directory. Never treat an archived HTML report or another category's Research Run as current product evidence. In a shared Git marketplace checkout, keep `.env`, databases, `output/`, logs, and build caches untracked and local.

## Select the workflow

- For opening or developing the local application, follow **Open and develop the application**.
- For a new product or category, follow **Research a new category** from scope confirmation onward.
- For new reviews, prices, sources, API data, supplier replies, or sample results added to an existing Run, follow **Update an existing report**.
- When generating or revising the seller report, read [references/category-research-output.md](references/category-research-output.md) completely before acting.

## Open and develop the application

1. Resolve the active project directory using the rules above, then verify it contains `package.json`, `src/app`, and the landing-page text `选品不该是猜爆款，而是把生意重新想明白`.
2. Verify `git merge-base --is-ancestor 8d7c746 HEAD` when Git history is available.
3. For a first-time Git marketplace installation only, if `node_modules` is absent run `npm install`; if `.env` or the local database is absent run `npm run setup`; then run `npm run test:portable`. Treat these as installation steps authorized by the user's request to install the GitHub package.
4. Probe `http://localhost:3000`. Reuse it only if the listener belongs to the resolved project. Otherwise start `npm run dev -- -p 3001`, or the next free port, from the resolved project.
5. Outside first-time installation, do not run setup, migrations, seeds, fixture resets, deployment, or destructive Git operations merely to open the app.
6. Preserve unrelated uncommitted work. Use existing scripts and schemas, make focused changes, and run the narrowest relevant validation.

## Research a new category

### 1. Open the combined-input workbench

For a new category, use a UI-first flow by default. Do not replace the product interface with a long research-object passport in chat.

1. Open the canonical application and navigate the visible in-app browser to `/discover#discovery-inputs`, so the combined-input form is the first relevant content the user sees.
2. Prefill the page from the user's message through query parameters when values are known, keeping `#discovery-inputs` at the end of the URL:
   - `category` for a keyword, category, product, pain point, or usage scene;
   - `imageUrls` for one or more public image URLs separated by newlines;
   - `competitorUrls` for one or more product, marketplace, brand, or competitor URLs separated by newlines;
   - `market`, `channel`, and `audience` for the remaining scope.
3. Treat keyword, images, and product links as combinable evidence inputs. Never force the user to choose only one input mode.
4. Show the workbench to the user so they can add, remove, or correct any of the three input groups.
5. Keep the chat response short: say that the workbench has been opened and that research will continue after page confirmation. Do not duplicate the full form or scope passport in chat.

Submitting the workbench must navigate to `/discover/plan`, where the page displays **确认研究对象** with the interpreted product, market, channel, input counts, evidence boundaries, and the six seller questions. The user confirms there by clicking **确认并继续研究**.

This page confirmation is a required product step. Explicitly tell the user when this skill pauses for it. Do not create a live Research Run before the confirmation is saved.

### 2. Open and keep the live research whiteboard

After the user clicks **确认并继续研究**, the application must immediately open:

`/discover/plan/whiteboard?discoveryId=<discovery-id>`

This whiteboard is the primary research interface for the rest of the task. Keep it visible during research; do not send the user back to a chat-only workflow and do not wait until the final report to create it. The application initializes `output/discovery/<discovery-id>/research-whiteboard.json` when confirmation is saved.

The whiteboard must show the current category only, using this flow:

```text
输入与范围 → 数据来源 → Agent 采集记录 → 整理分析 → 六大报告与执行
```

Chat updates should remain short and should point the user to the live whiteboard for detail.

### 3. Create one isolated Research Run

After the page reaches `/discover/plan/whiteboard`:

1. Read the saved `output/discovery/<discovery-id>/discovery-plan.json` rather than reconstructing scope from the conversation.
2. Resolve any placeholder product name produced by image-only or link-only input before live evidence collection.
3. Read `docs/prompts/live-web-research.md` and every project standard it routes to for the requested evidence lanes.
4. Load and follow the available `web-access` skill before any internet access.
5. Create a new Run with `npm run research:live`; never retrofit a previous Run or reuse its evidence.
6. Create it with `npm run research:live -- --discovery <discovery-id>`. The command must refuse to start without a saved confirmation and automatically bind the Run to the whiteboard before the first evidence search.
7. Keep all confirmed keyword, image, link, market, channel, audience, inclusion, and exclusion inputs attached to this Run. A material scope or market change creates a new scope version and may require a new Run.

### 4. Collect evidence in visible lanes

Collect and keep separate:

1. **Market evidence** — demand signals, trend evidence, category structure, public prices, and competition intensity.
2. **Customer evidence** — reviews and discussions describing buyers, triggering scenes, pains, desired outcomes, objections, alternatives, and counterevidence.
3. **Competitor evidence** — who sells, click hooks, trust mechanisms, offers, proof, price, positioning, and conversion paths.
4. **Supply evidence** — supplier candidates, searchable product language, specification clues, MOQ or quote only when formally observed.
5. **Compliance evidence** — authoritative rules and claim boundaries for the target market.

Record every executed query at execution time in `search_log.json`, including queries with no relevant results and blocked surfaces. Preserve channel, exact query, execution time when known, outcome, kept source IDs, extracted count, deduplicated count, and valid count when the surface supports them.

Update the whiteboard throughout collection, not afterward:

1. Before starting a lane, mark it `in_progress` with a plain-language message.
2. After each executed search or material source addition, update query, source, and valid-record counts.
3. For every retained or blocked source, add its URL, label, kind, and status.
4. When a lane is sufficiently processed for this research round, mark it `complete`; use `blocked` only when the lane is genuinely blocked.
5. Update `synthesis` while organizing price, trend, audience, competitor, opportunity, and gap findings.
6. Update each of the six `*_report` stages while generating that module, then update `execution` for the action plan and evidence-return loop.

Use the project command for all writes:

```bash
npm run research:whiteboard -- update \
  --discovery <discovery-id> \
  --stage <stage-code> \
  --status <pending|in_progress|complete|blocked> \
  --message "<plain-language progress or finding>" \
  --query-count <count> \
  --source-count <count> \
  --record-count <count> \
  --run <research-run-id>
```

Add `--source-url`, `--source-label`, `--source-kind`, and `--source-status` whenever a source is added. The page refreshes automatically, so the user should see these changes without reopening it.

### 5. Preserve evidence boundaries

- Distinguish direct evidence, derived analysis, hypothesis, and unknown.
- Search snippets are discovery aids, not evidence; open and read the source.
- Competitor claims do not prove target-product performance.
- Public supplier pages identify candidates, not supplier reliability, formal quotes, or final SKUs.
- Do not invent market size, sales, search volume, margin, certification, sample performance, or publication dates.
- A blocked source is not evidence of absence.
- Preserve supporting evidence and counterevidence together.

### 6. Produce the seller report

Make the default report detailed but easy to scan. Present the process as a traceable whiteboard:

```text
研究对象确认
→ 数据来源
→ Agent 采集记录
→ 整理分析
→ 六大卖家问题报告
→ 执行方案
→ 新证据回流
```

The primary report must answer exactly these six seller questions in this order:

1. 市场与机会
2. 用户画像
3. 竞品分析
4. 产品方案
5. 营销打法
6. 验证方案

Show each module's plain-language core conclusion by default. Put detailed evidence, source records, methods, uncertainty, and historical versions in expandable drawers or the audit layer. Do not use an unexplained numeric score as the main conclusion; say whether it is worth continuing, how competitive it is, where the opportunity lies, and what remains unproven.

Use seller-facing states `NOT_WORTH_PURSUING`, `RESEARCH_MORE`, and `READY_FOR_SOURCING` only as bounded decision language. Never imply listing approval, advertising approval, supplier approval, or commercial success.

When a standalone HTML prototype or report is requested, use `docs/yoga-pants-decision-whiteboard-prototype.html` as the interaction and information-architecture reference, but replace every yoga-pants fact with current-Run evidence. Do not copy its evidence, counts, conclusions, or product direction.

The default standalone artifact is `reports/whiteboard-report.html`. Treat `analysis-report.html`, `decision-report.md`, and pre-sample briefs as compatibility or audit artifacts only. Do not present them as the primary user report. The final chat handoff must link the live whiteboard and, when generated, `whiteboard-report.html`.

Before completing a cross-category Run, search the current analysis and report for terms belonging to another product category. If any appear, regenerate the affected module from current-Run evidence before handoff.

## Update an existing report

Treat additional reviews, API feeds, price points, supplier replies, or sample results as a new immutable evidence batch:

1. Identify the target Research Run and the new batch's source, capture time, scope, and record count.
2. Append the batch; never overwrite or silently rewrite old evidence.
3. Validate records, deduplicate within and across batches, and retain provenance for every kept item.
4. Recompute only affected customer themes, market findings, competitor patterns, product requirements, marketing boundaries, economics assumptions, and validation gates.
5. Produce an explicit before/new-evidence/after impact summary.
6. Create a new report version while keeping earlier versions available for comparison.
7. Downgrade or reverse conclusions when new counterevidence requires it.

External sources such as SEMrush, FastMoss, marketplace APIs, supplier systems, or sample-test data must enter through the same batch and provenance model. A stronger database enhances evidence collection; it does not bypass source boundaries or validation.

## Validate and hand off

For a live Run, validate Claim–Source mappings, search-log integrity, run isolation, and report rendering with the project's existing commands. Honest `RESEARCH_MORE` or `NOT_WORTH_PURSUING` results are valid outcomes.

Every completed work turn must end with:

- **本轮输出报告** — what changed, artifacts, validation, and whether it is local or deployed.
- **下一轮建议** — the single highest-value next step.
