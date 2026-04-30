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
- `2026-04-30T01:32:00Z` Switched from the sandboxed Codex environment to host-side verification so GitHub, Dokploy, and devnet actions could be completed for real.
- `2026-04-30T01:35:00Z` Created the public GitHub repo, pushed the build, and provisioned the Dokploy project plus compose service at `licenseshelf073.colmena.dev`.
- `2026-04-30T01:50:00Z` Traced multiple Dokploy image failures to vendored MPL Core artifacts missing from the container context, then fixed the repo by committing the required package and runtime dist files.
- `2026-04-30T02:05:00Z` Applied the live Dokploy runtime env block, redeployed successfully, and verified `/api/bootstrap` returned `configStatus.status = ready`.
- `2026-04-30T02:10:00Z` Completed a real live devnet issuance flow, which stored asset `DgAVYCUwQ7MxAfxT6Vd2iK5VGQkq4PvJpP5JvmQu6fdf` and transaction `3hd2BQccnA4aawTRhx99HBPxVTS2zFT28MrwRMmp4AiBFcWQnVj9VGnEiAfpprvJX4BwoEu8BTrWwhw8ezmM8XSG` for wallet `obrE1BHvP4EX8PkxPxAJxYfQkgfgCmXyJadQA3yBb7G`.

## Verification

- `npm install --ignore-scripts --offline --no-progress` — passed
- `npm run typecheck` — passed
- `npm run build` — passed
- `LICENSESHELF_DISABLE_LISTEN=1 node --input-type=module -e 'const mod = await import("./dist/server/index.js"); const response = await mod.app.fetch(new Request("http://localhost/api/health")); console.log(await response.text())'` — passed
- `curl -s https://licenseshelf073.colmena.dev/api/health` — passed
- `curl -s https://licenseshelf073.colmena.dev/api/bootstrap | jq '.configStatus.status'` — passed (`"ready"`)
- live issuance stored asset `DgAVYCUwQ7MxAfxT6Vd2iK5VGQkq4PvJpP5JvmQu6fdf` with tx `3hd2BQccnA4aawTRhx99HBPxVTS2zFT28MrwRMmp4AiBFcWQnVj9VGnEiAfpprvJX4BwoEu8BTrWwhw8ezmM8XSG` — passed

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
- Dokploy deploy with live URL: `done`
- Healthy live runtime config: `done`
- Real devnet mint with tx signature: `done`
- Final committed and pushed public GitHub repo under `obrera`: `done`

## Live Verification Notes

- Public repo: `https://github.com/obrera/nightshift-073-licenseshelf`
- Live URL: `https://licenseshelf073.colmena.dev`
- Live runtime config: `ready`
- Verified live issuance wallet: `obrE1BHvP4EX8PkxPxAJxYfQkgfgCmXyJadQA3yBb7G`
- Verified live asset: `DgAVYCUwQ7MxAfxT6Vd2iK5VGQkq4PvJpP5JvmQu6fdf`
- Verified live tx: `3hd2BQccnA4aawTRhx99HBPxVTS2zFT28MrwRMmp4AiBFcWQnVj9VGnEiAfpprvJX4BwoEu8BTrWwhw8ezmM8XSG`
