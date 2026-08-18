# Live Web Research Prompt Template

Use the current project and perform a new live research run.

Inputs:

- Product name: `<PRODUCT_NAME>`
- Product image paths: `<OPTIONAL_LOCAL_IMAGE_PATHS>`
- Target market: `<MARKET>`
- Competitor URLs: `<PUBLIC_COMPETITOR_URLS>`
- Target audience: `<TARGET_AUDIENCE>`

Requirements:

1. Create one unique Research Run with `npm run research:live`.
2. Load and follow the Codex `web-access` Skill.
3. Access only public webpages and save traceable Source snapshots.
4. Do not reuse fixture Sources, old Evidence Packages or sample reports.
5. Keep unsupported product, supplier, logistics, economics and compliance facts unresolved.
6. Validate Claim-Source mappings and keep competitor facts isolated from target-product facts.
7. Finalize the package and generate Markdown and HTML reports.
8. Report the decision honestly; `HOLD_SUPPLY` and `REJECT` are acceptable outcomes.
9. All seller-visible conclusions, evidence summaries, unknowns, action plans and generated report copy must be written in Simplified Chinese. Keep English only for executed search keywords, sourcing keywords, platform field names, exact product/model names, certification abbreviations and other terms whose original spelling is operationally necessary.

## Seller-analysis and report contract

Every live Run must produce seller-facing analysis that is quantitative where the current evidence permits, but never manufacture a denominator or convert qualitative samples into population incidence.

1. Put a visible research-basis strip above the six modules. It must show the research object, market, channel, snapshot time, executed-query count, retained-source count, verified-source count and current Run identity when available.
2. Write each module in the order `core judgment -> current-run evidence -> commercial implication -> current action -> pass gate -> stop or non-upgrade condition`.
3. Keep useful numbers next to the sentence they support. Every number must preserve its unit, time window, platform or source family, sample boundary, and whether it is observed, estimated or a test threshold.
4. Break customer evidence down by independent source family or channel. Do not collapse marketplace reviews, communities, brand/support surfaces and specialist sources into one undifferentiated VOC total.
   - Preserve the observation unit (`review`, `response`, `discussion_thread` or `mixed`), platform, source family, source ID, model/entity when known, themes, triggering scene and sentiment-coding status.
   - Treat themes and scenes as multi-label unless the adapter explicitly guarantees exclusivity. Never sum overlapping theme counts into a sample denominator.
   - When polarity was not coded record by record, display `unknown` rather than deriving positive/negative percentages from titles, aggregate ratings or analyst summaries.
   - Keep source-family gaps visible, including zero marketplace reviews, zero brand/support records, zero specialist sources or missing purchase attribution.
5. Compare competitors only on a shared basis. Preserve capture window, pack size, seller type, one-time versus subscription price, shipping treatment and missing fields; if the basis is not comparable, say so instead of ranking.
6. Attach a measurable pass gate to every proposed action. A gate may be a required evidence package, a relative A/B result, a user-task threshold, a sample-test threshold, a formal-quote requirement or an economics threshold. Label it as a hypothesis until executed.
7. Keep the four evidence labels visible: fact, directional evidence, hypothesis and unknown/gap. A high count never upgrades an unsupported target-SKU claim.
8. Show which source families the active module actually cites and allow every visible conclusion to drill down to current-run sources.
9. Keep conclusions scannable: one lead judgment followed by short complete-sentence points. Avoid dense bold paragraphs, decorative word clouds without normalization, unexplained sentiment percentages and charts without denominators.
10. Validate the live whiteboard and the standalone export separately. PDF or print output must not split a chart or evidence card across pages or leave a mostly blank trailing page.

After Atomic Claims are valid, continue the same Run without repeating web research or Source import:

1. Run `npm run workbench -- prepare-first-principles --current --json`.
2. Use only the Task's allowed Claim IDs and explicit user resource inputs.
3. Strip the product label and reframe the concrete user problem.
4. Separate facts, hypotheses, and unknowns.
5. Create Demand Atoms, Supply Atoms, and hard/soft/pseudo Constraints.
6. Create 2-4 distinct demand-supply Opportunity combinations with explainable scores.
7. Recommend one bounded opportunity and design at least three experiments in a 7-14 day plan.
8. Keep public supplier pages as candidates, not formal quotes or target-SKU facts.
9. Validate, import, summarize, and finalize through the Workbench CLI.
10. Keep Formal SKU at `HOLD_SUPPLY` and Listing/Ad Test blocked whenever P0 evidence is missing.

After the positioning, VOC, Demand Field and sample-stage boundaries are available, generate marketing translation for the same Research Run:

1. Run `npm run marketing:generate -- --run <RESEARCH_RUN_ID>`.
2. Reuse the existing `marketingTranslation` model. Do not create a parallel copy model.
3. Map every message pillar to current-run Claim, VOC Cluster, VOC Observation, Demand Atom, Demand Field Need, sample-test or compliance-review evidence.
4. Keep competitor selling points separate from target-SKU verified claims.
5. Classify every expression as `supported`, `directional`, `hypothesis`, or `prohibited`.
6. Treat emotion language as a research hypothesis unless direct evidence supports it.
7. Put unsupported medical, permanent-effect, certification, patent, performance-number and scarcity claims in `prohibitedClaims`.
8. When either Listing or Ad Test is blocked, all channel expressions must remain `draft_for_validation`.
9. Do not let marketing copy change opportunity scores, Product Decision, Formal SKU, Listing permission or Ad Test permission.
10. Regenerate the Markdown, HTML and seller-facing report from the same translation object, then run the mapping validator.
