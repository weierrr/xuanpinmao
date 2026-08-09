# Portable Package Validation

Validation date: 2026-07-23

The package was zipped, extracted into a new temporary directory and validated without reusing the source workspace's dependencies, database or build cache.

| Command | Result |
| --- | --- |
| `npm install` | PASS, 488 packages installed from scratch |
| `npm run setup` | PASS, env template copied, Prisma generated, 2 migrations applied, T21 regression fixture seeded |
| `npm run doctor` | PASS, required Node/npm/Prisma/SQLite/environment checks passed; known web-access path detected |
| Doctor without a known Skill path | PASS with WARNING and exit code 0 |
| `npm run test` | PASS, 9 files and 60 tests |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run dev` | PASS, server ready on port 3000 |
| 7 seeded workbench routes | PASS, all HTTP 200 |

`package.json` uses `"dev": "next dev"` and `"build": "next build"`. No POSIX shell environment assignment is present, so Windows PowerShell, Windows cmd, macOS and Linux use the same npm commands after `npm run setup` creates `.env`.

The final ZIP excludes `node_modules`, `.next`, `.env`, SQLite files, logs, caches, prior Evidence Packages and generated reports. No real API key or personal absolute path is included.

Known dependency audit status: npm reported 3 transitive dependency vulnerabilities (1 moderate, 2 high). No unreviewed dependency upgrade was applied during packaging.
