# Phase 4 First-Principles Opportunity Engine

> **Status: superseded.** Historical engine delivery document. See [Current State Verified](../CURRENT_STATE_VERIFIED.md) and [Product Scope: Pre-Sample](../PRODUCT_SCOPE_PRE_SAMPLE.md).

## Purpose

The engine converts current-run Atomic Claims into evidence-bounded opportunity hypotheses. It sits between Atomic Claims and Commercial Intelligence:

```text
Research Input -> Evidence Package -> Atomic Claims
-> First-Principles Opportunity Engine
-> Commercial Intelligence -> Product Selection
-> Risk -> Unit Economics -> Formal SKU Decision
```

It reframes the user problem, separates facts from hypotheses and unknowns, atomizes demand and supply, maps constraints, creates 2-4 distinct opportunities, and defines a 7-14 day validation plan. It does not turn hypotheses into facts or unlock procurement, Listing, or Ad Test gates.

## Artifacts And Persistence

Each Research Run owns an isolated directory:

```text
output/codex-native/<run-id>/
  first-principles-task.json
  first-principles-bundle.json
  first-principles-validation.json
  commercial-intelligence-first-principles.json
  first-principles-summary.md
```

The imported stage is persisted as the idempotent `WorkflowStageRun` key:

```text
<run-id> + first_principles + attempt 1
```

No Prisma schema change is required. Existing Evidence Packages and fixture conclusions are not overwritten.

## Bundle Schema

`src/first-principles/types.ts` defines the Zod contract:

- `ProblemReframe`
- `ReasoningItem` grouped as fact, hypothesis, and unknown
- `DemandAtom`
- `SupplyAtom`
- hard, soft, and pseudo `ConstraintItem`
- 2-4 `OpportunityHypothesis` records
- eight explainable score dimensions per opportunity
- `ValidationExperiment`
- resources and constraints supplied by the user
- a three-level decision summary

Scores may be `not_scored` with `null` when evidence is missing. Public supplier pages remain candidate signals unless target-SKU evidence exists.

## Codex-Native Workflow

```bash
npm run workbench -- prepare-first-principles --current --json
npm run workbench -- validate-first-principles --current \
  --file output/codex-native/<run-id>/first-principles-bundle.json --json
npm run workbench -- import-first-principles --current \
  --file output/codex-native/<run-id>/first-principles-bundle.json --json
npm run workbench -- first-principles-summary --current --format markdown
npm run workbench -- finalize --current --json
npm run workbench -- export --current --json
npm run workbench -- urls --current --json
```

`prepare-first-principles` gives Codex the allowed current-run Claim IDs and output template. Codex writes the Bundle, then validation checks it before import. No DeepSeek API, OpenAI API, model switch, or Node.js web-access SDK is involved.

Optional resource inputs are accepted by `research:init` and `research:live`, including `--budget`, `--available-time`, `--team-size`, repeated resource/asset/risk options, `--acceptable-moq`, `--target-margin`, `--business-model`, and `--validation-goal`. Missing inputs remain explicit unknowns.

## Validation Discipline

Errors include:

- Run, product, or market mismatch;
- fixture use in a live run;
- missing or cross-run Claim IDs;
- unsupported facts and competitor-to-target evidence migration;
- target SKU verification based only on supplier candidates;
- broken Demand, Supply, Opportunity, or Experiment references;
- missing pass, fail, or stop criteria;
- invalid score or validation duration;
- missing recommended opportunity;
- any attempt to override Formal SKU, Listing, or Ad Test gates.

Warnings cover low evidence, hypothesis-heavy opportunities, candidate-only suppliers, unknown costs/resources, and overly similar opportunities.

## Commercial Intelligence Link

The generated mapping artifact links without rewriting Claims:

- C02 -> Demand Atoms
- C05 -> Supply Atoms and Constraints
- C06 -> Recommended Opportunity
- C07 -> Value Proposition and Explicit Non-goals
- C08 -> Validation Experiments
- Product Selection -> recommended opportunity and score

`formal_gate_override` is always false.

## Workbench And Reports

Routes:

- `/research/<run-id>/first-principles`
- `/research/<run-id>/commercial-intelligence`
- `/research/<run-id>/decision`
- `/research/<run-id>/report`

The First-Principles page exposes all nine review sections. Markdown and HTML reports include the concrete problem, evidence classes, atoms, constraints, opportunity portfolio, recommendation, rejected alternatives, validation plan, and decision boundary.

## Decision Discipline

A valid result can be:

```text
First-Principles: validate a bounded opportunity
Product Selection: PROCEED_TO_SAMPLE
Formal SKU: HOLD_SUPPLY
Listing: NO
Ad Test: NO
```

This is deliberate. Formal gates remain controlled by target-SKU supply, quality, compliance, logistics, risk, and unit-economics evidence.

## Known Limitations

- Codex produces the reasoning artifact; the project does not run an autonomous model API.
- The engine uses only current-run inputs and Claims and performs no web access.
- Resource inputs missing from an older Run remain unknown.
- Opportunity scores prioritize explainability and validation design; they do not predict commercial success.
- A supplier quote, physical sample, labels, landed economics, and claim substantiation still require separate evidence.
