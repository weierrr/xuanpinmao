# Installation

## 1. Prerequisites

- Node.js 18.18+
- npm 9+
- A local Codex environment
- The Codex `web-access` Skill enabled for real public-web research

`web-access` is a Codex Skill, not a Node.js SDK or npm dependency. This package does not require a DeepSeek API Key or an OpenAI API Key.

## 2. Local Setup

```bash
npm install
npm run setup
npm run doctor
```

Use these same commands in Windows PowerShell, Windows cmd, macOS and Linux. Do not manually run `export`, `set` or configure `DATABASE_URL`; setup creates `.env` from `.env.example`.

`npm run setup` performs three deterministic local operations:

1. generates Prisma Client;
2. creates and migrates a local SQLite database;
3. imports the frozen T21 regression fixture.

The generated `.env`, SQLite database, build output and logs are local-only and must not be shared.

## 3. Verification

```bash
npm run test:portable
npm run lint
npm run build
npm run dev
```

`npm run test:portable` validates the clean shared package without requiring historical report outputs. The full internal `npm test` suite also covers archived regression reports that are intentionally excluded from a share package.

Open `http://localhost:3000`. The seeded pages are explicitly fixture-backed. They prove installation health only.

Do not create a live Run directly from product and market CLI flags. Open `/discover`, confirm the research object, then pass its discovery ID to the live workflow. This is enforced so every Run has a visible whiteboard and a traceable six-module report.

## 4. Live Research Readiness

`npm run doctor` checks known local Skill paths only. A `PASS` is not final proof that live access works. If no fixed path is found, Doctor prints a `WARNING` and still succeeds when all required project checks pass. In both cases, follow `docs/CODEX_USAGE.md` to create a unique Research Run and perform a real public-web Smoke Test in Codex. That Smoke Test is the final acceptance check. Never reuse `fixtures/T21` or another run's Evidence Package as evidence for a new product.
