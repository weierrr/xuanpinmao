# 跨类目调研输出契约

Use this reference for every new-category seller report, whiteboard prototype, or report update.

## 1. Combined input and research-object confirmation

Open `/discover` first. The page accepts all three signal groups at the same time:

- product or category keywords;
- one or more public image URLs;
- one or more product, marketplace, brand, or competitor URLs.

After submission, show the research-object passport inside `/discover/plan`, not as a long chat message:

| Field | Requirement |
| --- | --- |
| Original input | Preserve the user's wording. |
| Interpreted product | Name the concrete sellable product, not only the broad category. |
| Market | State country or platform market explicitly. |
| Audience | State the likely buyer group as a hypothesis before research. |
| Included | Product forms covered by the Run. |
| Excluded | Similar meanings, adjacent categories, and non-target variants. |
| Questions | Preview the six seller questions below. |

Do not begin deep research until the user confirms or corrects the passport in the page. After confirmation, use the saved discovery plan as the authoritative input record.

## 2. Traceable whiteboard

Expose the research process in seven connected layers:

1. Research-object confirmation.
2. Data-source cards grouped by market, customer, competitor, supply, and compliance.
3. Collection records showing channel, query, time, extracted count, deduplicated count, valid count, and blocked or empty attempts.
4. Analysis cards for price and trend, audience and scenes, competitor conversion, opportunity, and evidence gaps.
5. The six-module seller report.
6. Product, sourcing, marketing, cost, and validation actions.
7. Feedback arrows showing how later evidence creates a new report version.

Every visible conclusion must open a detail layer containing source references, evidence type, applicability boundary, counterevidence, and unknowns.

The whiteboard is the report, not a progress-only companion. Its persisted model must contain the full six-module conclusions and expandable evidence items. A Research Run without a linked confirmed discovery plan is invalid for user delivery.

## 3. Six seller modules

### 01 市场与机会

Answer: 有没有市场、需求趋势、价格空间、竞争强度。

Default-visible conclusion should state demand status, competition level, usable price structure, opportunity window, and missing decisive data.

### 02 用户画像

Answer: 谁在买、什么场景触发、最焦虑什么、为什么下单。

Separate observed users from inferred personas. Show trigger scenes, jobs, anxieties, desired outcomes, objections, alternatives, and counterevidence.

### 03 竞品分析

Answer: 谁在卖、靠什么吸引点击、靠什么建立信任、靠什么成交。

Analyze the conversion chain rather than listing brands. Separate hook, proof, offer, price, trust mechanism, and purchase friction.

### 04 产品方案

Answer: 应该做成什么样、必要产品要求、寻源关键词、不能踩的坑。

Include a bounded product concept, must-have and must-not-have requirements, Chinese and English sourcing keywords, supplier questions, and unsupported performance claims to avoid.

### 05 营销打法

Answer: 核心价值主张、广告钩子、内容素材、可说与不可说。

Map every expression to evidence. Classify claims as supported, directional, hypothesis, or prohibited. Prioritize concrete content shots and proof assets.

### 06 验证方案

Answer: 买什么样品、测试什么、成本红线、通过和停止条件。

Define sample variants, test protocol, target participants, cost assumptions versus formal quotes, pass threshold, failure threshold, and immediate stop conditions.

## 4. Evidence language

Use four visible labels:

- **事实证据** — directly observed in the current Run.
- **方向性证据** — supports a direction but cannot prove the target SKU.
- **待验证假设** — a testable interpretation or proposal.
- **未知/缺口** — not obtained or not supported.

Never hide a material gap behind a confidence score. Prefer plain-language judgments such as “有需求但竞争高”“存在差异化窗口”“价格可参考但利润未知”“需要继续研究”.

## 5. Incremental update contract

For every new evidence batch, display:

| Item | Requirement |
| --- | --- |
| Batch identity | Stable ID, source family, captured time, scope. |
| Input count | Raw records received or extracted. |
| Cleaning | Duplicates, invalid records, and retained count. |
| Provenance | Source URL or system reference for each retained record. |
| Impact | Which modules and conclusions may change. |
| Diff | Before, new evidence, and recomputed conclusion. |
| Version | New report version without deleting the prior version. |

When an API is added later, model it as another source adapter that produces the same batch, source, observation, claim, and provenance fields.

## 6. Readability contract

- Make core conclusions visible without opening drawers.
- Keep primary navigation to the six seller modules.
- Put internal governance, schemas, search logs, and full source records in the traceability or appendix layer.
- Use short headings, plain Chinese, and specific business judgments.
- Preserve detailed information without forcing the seller to read the research process before seeing useful answers.
- Deliver `reports/whiteboard-report.html` as the primary standalone file. Keep legacy vertical reports only for compatibility and audit.
