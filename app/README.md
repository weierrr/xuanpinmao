# Cross-Border Product Due-Diligence Agent

This portable local Agent first confirms a combined keyword, image and competitor-link input, then turns it into:

- market-opportunity analysis;
- competitor commercial insight;
- product-positioning recommendations;
- evidence and risk boundaries;
- a plain-language seller decision with explicit gaps;
- a live traceable whiteboard and `reports/whiteboard-report.html` containing the six selection conclusions;
- evidence-bounded First-Principles opportunity portfolios and 7-14 day validation plans.

## Start

```bash
npm install
npm run setup
npm run doctor
npm run dev
```

Open `http://localhost:3000`. See `QUICK_START.md` and `INSTALL.md` for details.

Windows PowerShell, Windows cmd, macOS and Linux use the same commands. Setup creates `.env`; do not manually run `export`, `set` or configure `DATABASE_URL`.

## Live Research Boundary

No DeepSeek API Key is required. No OpenAI API Key is required. Real public-web collection runs through the `web-access` Skill in the recipient's Codex environment. The Skill is not bundled, is not a Node.js SDK and cannot be installed with npm.

Doctor checks known local Skill paths only: PASS is not final proof, while a missing-path WARNING is non-fatal. Before using the Agent for a real decision, enable `web-access` in Codex and complete the fresh live Smoke Test in `docs/CODEX_USAGE.md`. The Smoke Test is the final acceptance check.

## Data Safety

The included `fixtures/T21` directory is a frozen regression fixture required by automated tests and the initial local workbench. It is not a new web-research result and must never be reused as evidence for another product.

The portable package intentionally excludes all prior Evidence Packages, example reports, local databases, `.env` files, logs, caches, browser state and credentials.

## Commands

```bash
npm run setup
npm run doctor
npm run test:portable
npm run lint
npm run build
npm run dev
```

The portable test command covers the clean discovery, workbench and live-whiteboard flow without requiring archived report outputs, which are intentionally not included.

New live research must start from `/discover`, be confirmed on `/discover/plan`, and use the resulting discovery ID. Direct unconfirmed Research Runs are rejected. Live research commands are documented in `docs/CODEX_USAGE.md`.

After a new live Run has valid Atomic Claims, use the Codex-native `workbench` commands documented there to create and validate `first-principles-bundle.json`. This stage uses only current-run evidence, does not call DeepSeek or OpenAI APIs, and cannot unlock Formal SKU, Listing, or Ad Test gates.
