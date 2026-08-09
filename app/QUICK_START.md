# Quick Start

## Requirements

- Node.js 18.18 or newer
- npm
- Codex with the `web-access` Skill installed or enabled for live research

No DeepSeek API Key is required. No OpenAI API Key is required.

## Install And Start

```bash
unzip agent-package.zip
cd agent-package
npm install
npm run setup
npm run doctor
npm run test:portable
npm run dev
```

Open `http://localhost:3000`.

For a real category, always start from the combined-input page, confirm the research object in the page, and keep the live whiteboard open. The primary standalone deliverable is `reports/whiteboard-report.html`; the older vertical reports are audit-compatible attachments.

Windows PowerShell, Windows cmd, macOS and Linux use the same commands above. Do not manually run `export`, `set` or configure `DATABASE_URL`; `npm run setup` creates the local `.env`.

`npm run doctor` only checks known local paths for `web-access`. A PASS is not final proof of live capability, and a missing-path WARNING does not fail Doctor. The initial T21 records are frozen regression fixtures, not new web research. Before relying on the Agent for a product decision, follow `docs/CODEX_USAGE.md` and complete a fresh live Smoke Test with `web-access` in your own Codex environment.
