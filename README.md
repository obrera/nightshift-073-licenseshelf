# LicenseShelf

LicenseShelf is Nightshift build 073: a Solana-week consumer product shelf with wallet-first auth, MPL Core license issuance, entitlement verification, and an operator edition console. It is materially different from the prior editorial/review-oriented builds: the primary surface is a public shelf of digital products and license tiers, not a workflow tool.

## Product Shape

- Public shelf of seeded digital products with tier comparison and product detail storytelling
- Wallet-first Sign In With Solana using the connected wallet directly
- Authenticated issue flow that mints an MPL Core license asset to the signed-in wallet
- Entitlement checker and issuance history for the authenticated wallet
- Operator console for edition inventory, readiness, and audit activity
- Durable server-side persistence in `data/licenseshelf-db.json`

## Stack

- TypeScript throughout
- React + Vite frontend
- Hono-style backend surface served from one Node container and one domain
- `@obrera/mpl-core-kit-lib` as a required dependency
- `@solana/kit` for Solana primitives
- No `@solana/web3.js`
- No `@solana/wallet-adapter-react`

## Local Run

```bash
npm install --ignore-scripts --offline --no-progress
npm run typecheck
npm run build
npm start
```

Default runtime port:

- `http://localhost:3001`

Health endpoint:

- `GET /api/health`

In this sandbox, opening a listening socket is blocked with `listen EPERM`, so runtime verification was done by importing the built app and calling `app.fetch()` directly:

```bash
LICENSESHELF_DISABLE_LISTEN=1 node --input-type=module -e 'const mod = await import("./dist/server/index.js"); const response = await mod.app.fetch(new Request("http://localhost/api/health")); console.log(await response.text())'
```

## Environment

Required for real devnet issuance:

```bash
export LICENSESHELF_PUBLIC_BASE_URL="https://your-app.example.com"
export LICENSESHELF_DEVNET_SIGNER_KEYPAIR="/absolute/path/to/devnet-keypair.json"
export LICENSESHELF_EXECUTE_PLUGIN_COLLECTION_ADDRESS="YOUR_DEVNET_COLLECTION_ADDRESS"
```

Optional:

```bash
export LICENSESHELF_DEVNET_RPC_URL="https://api.devnet.solana.com"
export LICENSESHELF_DEVNET_WS_URL="wss://api.devnet.solana.com"
export LICENSESHELF_OPERATOR_WALLETS="comma,separated,operator,wallets"
export LICENSESHELF_DATA_PATH="/custom/path/licenseshelf-db.json"
export PORT="3001"
```

`LICENSESHELF_DEVNET_SIGNER_KEYPAIR` may be:

- a path to a keypair JSON file
- a raw JSON array
- a comma-separated 64-byte list
- a `base64:<value>` string

## Main API

- `GET /api/health`
- `GET /api/bootstrap`
- `GET /api/entitlements`
- `POST /api/auth/solana-auth/nonce`
- `POST /api/auth/solana-auth/verify`
- `POST /api/auth/logout`
- `POST /api/licenses/issue`
- `POST /api/operator/editions/:editionId`
- `GET /api/licenses/:issuanceId/metadata.json`
- `GET /license-art/:editionId.svg`

## Deploy

The repo ships a single-container `Dockerfile` and `docker-compose.yml` shaped for Dokploy. The compose file joins `dokploy-network` and persists `/app/data`.

Blocked in this sandbox on `2026-04-30`:

- `gh auth status` reports the saved GitHub token for `obrera` is invalid
- `dokploy project all` fails with `getaddrinfo EAI_AGAIN ship.colmena.dev`
- `curl https://api.devnet.solana.com ...` fails with `Could not resolve host: api.devnet.solana.com`

Because of those external blockers, this session could not:

- create or push the public GitHub repo
- deploy to Dokploy and verify a live URL
- run a real devnet mint and capture a transaction signature

## Current Verification State

- `npm run typecheck` passed
- `npm run build` passed
- in-process `/api/health` verification passed
- live devnet issuance is blocked pending real DNS/network access plus signer and collection configuration

## Notes

- The backend code uses a minimal local `hono` and `@hono/node-server` shim package because npm registry access is blocked in this sandbox. The app surface still follows the Hono-style handler model required by the build brief.
- `data/licenseshelf-db.json` contains the seeded LicenseShelf catalog and is safe to replace in production with a mounted persistent volume.
