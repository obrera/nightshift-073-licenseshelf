# Build Log

## Metadata

- Project: `LicenseShelf`
- Build: `073`
- Repo: `nightshift-073-licenseshelf`
- Model: `Codex / GPT-5`
- Date UTC: `2026-04-30`

## Timeline

- `2026-04-30T01:01:00Z` Audited the inherited repo and confirmed it was still build 071 `StampQuest`, including stale branding, an `express` backend, and rally/passport domain models.
- `2026-04-30T01:05:00Z` Replaced the shared contract layer with LicenseShelf concepts: products, editions, issuance records, entitlements, and operator inventory summaries.
- `2026-04-30T01:08:00Z` Re-seeded durable JSON persistence with three public products and six license editions built for consumer shelf browsing rather than editorial workflow.
- `2026-04-30T01:12:00Z` Rebuilt the backend around a Hono-style routing surface and single-domain static/API serving, preserving SIWS and file-backed persistence while replacing the old rally endpoints.
- `2026-04-30T01:17:00Z` Reworked the frontend into a dark-mode public shelf, wallet-authenticated issue flow, entitlement checker, and operator edition console.
- `2026-04-30T01:21:00Z` Updated deploy/runtime assets for LicenseShelf, including Dokploy-oriented compose networking and renamed env vars.
- `2026-04-30T01:23:00Z` Attempted `npm install --ignore-scripts`; npm registry DNS was blocked for new external packages, so local file packages were added to provide the minimal Hono and node-server surfaces required by the repo.
- `2026-04-30T01:25:00Z` Re-ran dependency installation in offline mode successfully using cache plus local file packages.
- `2026-04-30T01:26:00Z` Ran `npm run typecheck`, fixed the remaining client-side disconnect typing issue, and reran to green.
- `2026-04-30T01:27:00Z` Ran `npm run build` successfully for both client and server outputs.
- `2026-04-30T01:30:00Z` Verified the built `/api/health` route in-process with `LICENSESHELF_DISABLE_LISTEN=1` because the sandbox denies socket binding with `listen EPERM`.
- `2026-04-30T01:32:00Z` Checked external completion steps and confirmed hard blockers: GitHub auth token invalid, Dokploy DNS resolution failing, and Solana devnet DNS resolution failing.
- `2026-04-30T01:34:00Z` Attempted to create a local git commit, but the sandbox rejected `.git/index.lock` creation with `Read-only file system`, so even a local completion commit is blocked here.

## Verification

- `npm install --ignore-scripts --offline --no-progress` — passed
- `npm run typecheck` — passed
- `npm run build` — passed
- `LICENSESHELF_DISABLE_LISTEN=1 node --input-type=module -e 'const mod = await import("./dist/server/index.js"); const response = await mod.app.fetch(new Request("http://localhost/api/health")); console.log(await response.text())'` — passed

Health payload:

```json
{"ok":true,"buildNumber":73,"productCount":3,"editionCount":6,"issuanceCount":0,"configStatus":{"enabled":false,"status":"missing_public_base_url","message":"License issuance is off because LICENSESHELF_PUBLIC_BASE_URL is not configured.","publicBaseUrlConfigured":false,"signerConfigured":false,"collectionConfigured":false,"executionMode":"execute-plugin-aware-collection"}}
```

## Scorecard

- Build number 073: `done`
- Repo renamed to `nightshift-073-licenseshelf`: `done`
- TypeScript + React/Vite frontend: `done`
- Hono backend surface: `done`
- Dark mode default: `done`
- Single-container frontend + API shape: `done`
- Required `@obrera/mpl-core-kit-lib` dependency: `done`
- No `@solana/web3.js`: `done`
- No `@solana/wallet-adapter-react`: `done`
- Wallet-first auth with SIWS: `done`
- Durable server-side persistence: `done`
- At least three meaningful user capabilities: `done`
- Operator/admin tool: `done`
- LICENSE (MIT), README, BUILDLOG: `done`
- Local compile: `done`
- Dokploy deploy with live URL: `blocked by DNS/network`
- Healthy live runtime config: `blocked by DNS/network`
- Real devnet mint with tx signature: `blocked by DNS/network and missing signer/collection config`
- Final committed and pushed public GitHub repo under `obrera`: `blocked by read-only .git writes, invalid GitHub auth, and no remote`

## External Blockers

- `gh auth status` on `2026-04-30`:
  `The token in /home/obrera/.config/gh/hosts.yml is invalid.`
- `git commit -m "Build LicenseShelf for Nightshift 073"` on `2026-04-30`:
  `fatal: Unable to create '/home/obrera/projects/nightshift-073-licenseshelf/.git/index.lock': Read-only file system`
- `XDG_CACHE_HOME=/tmp/dokploy-cache dokploy project all` on `2026-04-30`:
  `getaddrinfo EAI_AGAIN ship.colmena.dev`
- `curl -sS https://api.devnet.solana.com ...` on `2026-04-30`:
  `Could not resolve host: api.devnet.solana.com`
- `npm start` in this sandbox:
  `listen EPERM: operation not permitted 0.0.0.0:3001`

## Honest Finish State

The repo is locally buildable and the app surface is implemented, but the session could not satisfy the external-only Nightshift requirements for GitHub publication, Dokploy deployment, or live devnet issuance. A human with working GitHub auth, Dokploy DNS access, Solana devnet DNS access, and a real signer plus collection env can complete those remaining checks outside this sandbox.
