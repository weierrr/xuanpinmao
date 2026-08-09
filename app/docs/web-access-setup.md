# web-access Setup Boundary

`web-access` runs inside Codex. It is not included in this repository, cannot be installed by `npm install`, and is not a Node.js SDK.

The Agent does not require a DeepSeek API Key or an OpenAI API Key. Windows PowerShell, Windows cmd, macOS and Linux use the same npm installation commands.

The recipient must:

1. install or enable `web-access` in their own Codex environment;
2. open this project as the active Codex workspace;
3. run `npm run doctor` and review its local-path result;
4. perform a fresh public-web Smoke Test before trusting live research output.

Doctor checks only known local Skill paths. Detection is a useful hint, not final proof. A missing-path result is reported as WARNING and does not make Doctor fail when Node.js, npm, Prisma, environment and database checks pass. The real Codex联网 Smoke Test is the final capability acceptance.

The project's live CLI creates, validates, imports and reports an Evidence Package. Codex plus `web-access` performs the actual public-web collection between initialization and finalization.

Never provide account cookies, browser profiles, API keys or login credentials to the research run. Do not bypass login walls, CAPTCHAs or platform restrictions.
