import { serve } from "@hono/node-server";
import {
  fetchAssetsByOwner,
  fetchMaybeCollectionV1
} from "@obrera/mpl-core-kit-lib";
import {
  address,
  assertIsAddress,
  assertIsSignature,
  createSolanaRpc,
  devnet,
  getBase58Encoder,
  getPublicKeyFromAddress,
  signature,
  signatureBytes,
  verifySignature
} from "@solana/kit";
import { Hono, type Context } from "hono";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type {
  ActivityRecord,
  AppState,
  BootstrapResponse,
  EditionInventoryUpdateRequest,
  EditionRecord,
  EditionView,
  EntitlementItem,
  EntitlementSummary,
  IssueLicenseRequest,
  IssuanceRecord,
  LicenseMintConfigStatus,
  OperatorEditionSummary,
  OperatorOverview,
  ProductRecord,
  ProductView,
  SolanaAuthNonceRequest,
  SolanaAuthNonceResponse,
  SolanaAuthVerifyRequest,
  UserRecord,
  UserRole
} from "../shared/contracts.js";
import { BUILD_NUMBER } from "../shared/contracts.js";
import { FileDatabase } from "./db.js";
import { getLicenseMintConfigStatus } from "./minting/config.js";
import { issueLicenseAsset } from "./minting/solana.js";
import {
  clearCookieHeader,
  createId,
  createNonce,
  getEnv,
  normalizeWalletAddress,
  nowUtc,
  parseCookies,
  sanitizeUser,
  setCookieHeader,
  shortWalletAddress
} from "./utils.js";

interface ParsedSiwsMessage {
  address: string;
  chainId?: string;
  domain: string;
  expirationTime?: string;
  issuedAt?: string;
  nonce?: string;
  statement?: string;
  uri?: string;
  version?: string;
}

const rootDir = path.resolve(process.cwd());
const publicDir = path.resolve(rootDir, "dist", "public");
const cookieName = "licenseshelf_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 14;
const challengeMaxAgeMs = 15 * 60 * 1000;
const authStatement = "Sign in to LicenseShelf with your Solana wallet.";
const dataPath =
  getEnv("LICENSESHELF_DATA_PATH") ??
  getEnv("STAMPQUEST_DATA_PATH") ??
  path.resolve(rootDir, "data", "licenseshelf-db.json");
const port = Number(getEnv("PORT") ?? "3001");

const db = new FileDatabase(dataPath);
const app = new Hono();

function respondError(
  c: Context,
  status: number,
  message: string
) {
  return c.json({ error: message }, status);
}

function isFieldLine(value: string): boolean {
  return /^(URI|Version|Chain ID|Nonce|Issued At|Expiration Time|Not Before|Request ID|Resources): /.test(
    value
  ) || value === "Resources:";
}

function parseSiwsMessage(message: string): ParsedSiwsMessage {
  const normalized = message.replace(/\r/g, "");
  const lines = normalized.split("\n");
  const header = lines[0]?.match(/^(.*) wants you to sign in with your Solana account:$/);
  if (!header?.[1] || !lines[1]?.trim()) {
    throw new Error("Invalid SIWS message.");
  }

  const parsed: ParsedSiwsMessage = {
    domain: header[1],
    address: lines[1].trim()
  };

  let cursor = 2;
  if (lines[cursor] === "") {
    cursor += 1;
  }

  const fieldIndex = lines.findIndex((line, index) => index >= cursor && isFieldLine(line));
  if (fieldIndex === -1) {
    throw new Error("SIWS message is missing required fields.");
  }

  const statementLines = lines.slice(cursor, fieldIndex).filter((line) => line !== "");
  parsed.statement = statementLines.length > 0 ? statementLines.join("\n") : undefined;

  for (let index = fieldIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    const separator = line.indexOf(": ");
    if (separator === -1) {
      throw new Error("SIWS message contains an invalid field.");
    }

    const key = line.slice(0, separator);
    const value = line.slice(separator + 2);

    switch (key) {
      case "URI":
        parsed.uri = value;
        break;
      case "Version":
        parsed.version = value;
        break;
      case "Chain ID":
        parsed.chainId = value;
        break;
      case "Nonce":
        parsed.nonce = value;
        break;
      case "Issued At":
        parsed.issuedAt = value;
        break;
      case "Expiration Time":
        parsed.expirationTime = value;
        break;
      case "Resources":
        index = lines.length;
        break;
      default:
        break;
    }
  }

  return parsed;
}

async function verifySolanaWalletSignature(args: {
  message: string;
  signatureValue: string;
  walletAddress: string;
}): Promise<boolean> {
  const publicKey = await getPublicKeyFromAddress(address(args.walletAddress));
  return verifySignature(
    publicKey,
    signatureBytes(getBase58Encoder().encode(signature(args.signatureValue))),
    new TextEncoder().encode(args.message)
  );
}

function cleanupAuthState(state: AppState) {
  state.sessions = state.sessions.filter(
    (entry) => new Date(entry.expiresAt).getTime() > Date.now()
  );
  state.authChallenges = state.authChallenges.filter(
    (entry) => new Date(entry.expiresAt).getTime() > Date.now()
  );
}

function getOperatorWalletAllowlist(): Set<string> {
  return new Set(
    (getEnv("LICENSESHELF_OPERATOR_WALLETS") ?? getEnv("STAMPQUEST_OPERATOR_WALLETS") ?? "")
      .split(",")
      .map((entry) => normalizeWalletAddress(entry))
      .filter(Boolean)
  );
}

function resolveUserRole(walletAddress: string): UserRole {
  return getOperatorWalletAllowlist().has(normalizeWalletAddress(walletAddress))
    ? "operator"
    : "customer";
}

function getSessionUser(state: AppState, cookieHeader?: string): UserRecord | null {
  cleanupAuthState(state);
  const sessionId = parseCookies({ headers: { cookie: cookieHeader ?? "" } })[cookieName];
  if (!sessionId) {
    return null;
  }

  const session = state.sessions.find((entry) => entry.id === sessionId);
  if (!session) {
    return null;
  }

  const user = state.users.find((entry) => entry.id === session.userId);
  if (!user) {
    return null;
  }

  return {
    ...user,
    role: resolveUserRole(user.walletAddress)
  };
}

function makeActivity(
  user: UserRecord,
  kind: ActivityRecord["kind"],
  headline: string,
  detail: string
): ActivityRecord {
  return {
    id: createId("activity"),
    userId: user.id,
    userDisplayName: user.displayName,
    kind,
    headline,
    detail,
    createdAt: nowUtc()
  };
}

function getIssuedCount(state: AppState, editionId: string): number {
  return state.issuances.filter(
    (entry) => entry.editionId === editionId && entry.status !== "blocked"
  ).length;
}

function getMintedCount(state: AppState, editionId: string): number {
  return state.issuances.filter(
    (entry) => entry.editionId === editionId && entry.status === "minted"
  ).length;
}

function getEditionAvailability(
  edition: EditionRecord,
  state: AppState,
  userId?: string
): EditionView {
  const issuedCount = getIssuedCount(state, edition.id);
  const mintedCount = getMintedCount(state, edition.id);
  const remainingSupply = Math.max(edition.supplyCap - edition.reserveCount - issuedCount, 0);
  const userHasMinted = Boolean(
    userId &&
      state.issuances.find(
        (entry) =>
          entry.userId === userId &&
          entry.editionId === edition.id &&
          entry.status === "minted"
      )
  );
  const canIssue =
    edition.status === "live" && remainingSupply > 0 && !userHasMinted;

  let availabilityLabel = `${remainingSupply} left`;
  if (edition.status === "paused") {
    availabilityLabel = "Paused by operator";
  } else if (edition.status === "sold_out" || remainingSupply === 0) {
    availabilityLabel = "Sold out";
  } else if (userHasMinted) {
    availabilityLabel = "Already in your wallet";
  }

  return {
    ...edition,
    issuedCount,
    mintedCount,
    remainingSupply,
    userHasMinted,
    canIssue,
    availabilityLabel
  };
}

function buildProductViews(state: AppState, userId?: string): ProductView[] {
  return state.products.map((product) => ({
    ...product,
    editions: state.editions
      .filter((edition) => edition.productId === product.id)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((edition) => getEditionAvailability(edition, state, userId))
  }));
}

async function verifyEntitlements(
  state: AppState,
  user: UserRecord | null,
  configStatus: LicenseMintConfigStatus
): Promise<EntitlementSummary> {
  if (!user) {
    return {
      holdings: [],
      history: [],
      collectionStatus: configStatus.message
    };
  }

  const productsById = new Map(state.products.map((entry) => [entry.id, entry]));
  const editionsById = new Map(state.editions.map((entry) => [entry.id, entry]));
  const userIssuances = state.issuances
    .filter((entry) => entry.userId === user.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const assetIdsOnChain = new Set<string>();
  let collectionStatus = configStatus.message;

  if (configStatus.enabled && configStatus.collectionAddress) {
    const rpc = createSolanaRpc(
      devnet(
        getEnv("LICENSESHELF_DEVNET_RPC_URL") ??
          getEnv("STAMPQUEST_DEVNET_RPC_URL") ??
          "https://api.devnet.solana.com"
      )
    );
    const collection = await fetchMaybeCollectionV1(rpc, address(configStatus.collectionAddress));

    if (collection.exists) {
      const assets = await fetchAssetsByOwner(rpc, address(user.walletAddress));
      for (const account of assets) {
        const updateAuthority = (account.data as { updateAuthority?: { type?: string; address?: string } })
          .updateAuthority;
        if (
          updateAuthority?.type === "Collection" &&
          updateAuthority.address === configStatus.collectionAddress
        ) {
          assetIdsOnChain.add(account.address);
        }
      }
      collectionStatus = `Collection verified on devnet: ${shortWalletAddress(
        configStatus.collectionAddress
      )}`;
    } else {
      collectionStatus = "Configured MPL Core collection was not found on devnet.";
    }
  }

  const history = userIssuances.map<EntitlementItem>((entry) => {
    const product = productsById.get(entry.productId) as ProductRecord;
    const edition = editionsById.get(entry.editionId) as EditionRecord;

    let verificationStatus: EntitlementItem["verificationStatus"] = "recorded_locally";
    let verificationMessage = entry.message;

    if (!configStatus.enabled) {
      verificationStatus = "missing_collection_config";
      verificationMessage = configStatus.message;
    } else if (entry.assetAddress && assetIdsOnChain.has(entry.assetAddress)) {
      verificationStatus = "verified_on_chain";
      verificationMessage = "Verified against the configured MPL Core collection on devnet.";
    } else if (entry.status === "minted") {
      verificationStatus = "not_found_on_chain";
      verificationMessage =
        "Mint record exists locally but the asset was not found in the connected wallet for the configured collection.";
    }

    return {
      issuanceId: entry.id,
      productName: product.name,
      editionName: edition.name,
      walletAddress: entry.walletAddress,
      issuedAt: entry.createdAt,
      status: entry.status,
      verificationStatus,
      verificationMessage,
      assetAddress: entry.assetAddress,
      signature: entry.signature,
      explorerUrls: entry.explorerUrls
    };
  });

  return {
    walletAddress: user.walletAddress,
    holdings: history.filter((entry) => entry.status === "minted"),
    history,
    collectionStatus
  };
}

function buildOperatorOverview(
  state: AppState,
  configStatus: LicenseMintConfigStatus
): OperatorOverview {
  const productsById = new Map(state.products.map((entry) => [entry.id, entry]));
  const editions: OperatorEditionSummary[] = state.editions
    .map((edition) => ({
      editionId: edition.id,
      productName: (productsById.get(edition.productId) as ProductRecord).name,
      editionName: edition.name,
      status: edition.status,
      supplyCap: edition.supplyCap,
      reserveCount: edition.reserveCount,
      issuedCount: getIssuedCount(state, edition.id),
      mintedCount: getMintedCount(state, edition.id),
      remainingSupply: Math.max(
        edition.supplyCap - edition.reserveCount - getIssuedCount(state, edition.id),
        0
      )
    }))
    .sort((left, right) =>
      `${left.productName}:${left.editionName}`.localeCompare(`${right.productName}:${right.editionName}`)
    );

  return {
    totalProducts: state.products.length,
    totalEditions: state.editions.length,
    totalIssued: state.issuances.filter((entry) => entry.status !== "blocked").length,
    totalMinted: state.issuances.filter((entry) => entry.status === "minted").length,
    readinessMessage: configStatus.message,
    recentActivity: [...state.activity]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 8),
    editions
  };
}

async function buildBootstrap(state: AppState, user: UserRecord | null): Promise<BootstrapResponse> {
  const configStatus = getLicenseMintConfigStatus();
  return {
    buildNumber: BUILD_NUMBER,
    session: {
      user: user ? sanitizeUser(user) : null
    },
    configStatus,
    products: buildProductViews(state, user?.id),
    entitlements: await verifyEntitlements(state, user, configStatus),
    operatorOverview: user?.role === "operator" ? buildOperatorOverview(state, configStatus) : null
  };
}

function getProductAndEdition(state: AppState, productId: string, editionId: string) {
  const product = state.products.find((entry) => entry.id === productId);
  const edition = state.editions.find(
    (entry) => entry.id === editionId && entry.productId === productId
  );

  if (!product || !edition) {
    throw new Error("Product edition not found.");
  }

  return { product, edition };
}

function createLicenseMetadata(args: {
  collectionAddress: string;
  edition: EditionRecord;
  issuance: IssuanceRecord;
  product: ProductRecord;
}) {
  return {
    name: `${args.product.name} ${args.edition.name} License`,
    symbol: "LCS073",
    description: `${args.product.name} ${args.edition.name} entitlement issued by LicenseShelf build 073.`,
    image: `/license-art/${args.edition.id}.svg`,
    external_url: `/`,
    collection: {
      name: "LicenseShelf",
      family: "Nightshift 073",
      key: args.collectionAddress
    },
    attributes: [
      { trait_type: "Product", value: args.product.name },
      { trait_type: "Edition", value: args.edition.name },
      { trait_type: "SKU", value: args.edition.sku },
      { trait_type: "Issued To", value: args.issuance.walletAddress },
      { trait_type: "Issuance ID", value: args.issuance.id }
    ],
    properties: {
      category: "image",
      files: [{ uri: `/license-art/${args.edition.id}.svg`, type: "image/svg+xml" }]
    }
  };
}

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: error instanceof Error ? error.message : "Server error." }, 500);
});

app.get("/api/health", async (c) => {
  const state = await db.read();
  const configStatus = getLicenseMintConfigStatus();
  return c.json({
    ok: true,
    buildNumber: BUILD_NUMBER,
    productCount: state.products.length,
    editionCount: state.editions.length,
    issuanceCount: state.issuances.length,
    configStatus
  });
});

app.get("/api/bootstrap", async (c) => {
  const state = await db.read();
  const user = getSessionUser(state, c.req.header("cookie"));
  return c.json(await buildBootstrap(state, user));
});

app.get("/api/entitlements", async (c) => {
  const state = await db.read();
  const user = getSessionUser(state, c.req.header("cookie"));
  if (!user) {
    return respondError(c, 401, "Authentication required.");
  }

  return c.json(await verifyEntitlements(state, user, getLicenseMintConfigStatus()));
});

app.post("/api/auth/solana-auth/nonce", async (c) => {
  const body = (await c.req.json()) as SolanaAuthNonceRequest;
  const walletAddress = normalizeWalletAddress(body.walletAddress);

  try {
    assertIsAddress(walletAddress);
  } catch {
    return respondError(c, 400, "Wallet address must be a valid Solana address.");
  }

  const publicBaseUrl =
    getEnv("LICENSESHELF_PUBLIC_BASE_URL") ??
    getEnv("STAMPQUEST_PUBLIC_BASE_URL") ??
    `http://localhost:${port}`;
  const baseUrl = new URL(publicBaseUrl);
  const issuedAt = nowUtc();
  const expirationTime = new Date(Date.now() + challengeMaxAgeMs).toISOString();
  const challenge: SolanaAuthNonceResponse = {
    walletAddress,
    nonce: createNonce(),
    domain: baseUrl.host,
    uri: baseUrl.toString(),
    version: "1",
    issuedAt,
    expirationTime,
    chainId: "solana:devnet",
    statement: authStatement
  };

  await db.update((state) => {
    cleanupAuthState(state);
    state.authChallenges.push({
      id: createId("challenge"),
      walletAddress,
      nonce: challenge.nonce,
      domain: challenge.domain,
      uri: challenge.uri,
      chainId: challenge.chainId,
      statement: challenge.statement,
      issuedAt,
      expirationTime,
      createdAt: issuedAt,
      expiresAt: expirationTime
    });
  });

  return c.json(challenge);
});

app.post("/api/auth/solana-auth/verify", async (c) => {
  const body = (await c.req.json()) as SolanaAuthVerifyRequest;
  const walletAddress = normalizeWalletAddress(body.walletAddress);

  try {
    assertIsAddress(walletAddress);
    assertIsSignature(body.signature);
  } catch {
    return respondError(c, 400, "Invalid wallet address or signature.");
  }

  const parsed = parseSiwsMessage(body.message);
  if (
    parsed.address !== walletAddress ||
    parsed.statement !== authStatement ||
    parsed.version !== "1" ||
    !parsed.nonce ||
    !parsed.issuedAt ||
    !parsed.expirationTime
  ) {
    return respondError(c, 400, "SIWS message is malformed.");
  }

  const signatureValid = await verifySolanaWalletSignature({
    message: body.message,
    signatureValue: body.signature,
    walletAddress
  });
  if (!signatureValid) {
    return respondError(c, 401, "Signature verification failed.");
  }

  const result = await db.update((state) => {
    cleanupAuthState(state);
    const challengeIndex = state.authChallenges.findIndex(
      (entry) =>
        entry.walletAddress === walletAddress &&
        entry.nonce === parsed.nonce &&
        entry.statement === authStatement
    );
    if (challengeIndex === -1) {
      throw new Error("No valid wallet sign-in challenge was found.");
    }

    const challenge = state.authChallenges[challengeIndex];
    if (new Date(challenge.expirationTime).getTime() <= Date.now()) {
      state.authChallenges.splice(challengeIndex, 1);
      throw new Error("The wallet sign-in challenge has expired.");
    }

    state.authChallenges.splice(challengeIndex, 1);

    let user = state.users.find((entry) => entry.walletAddress === walletAddress);
    const now = nowUtc();
    const isNewUser = !user;

    if (!user) {
      user = {
        id: createId("user"),
        walletAddress,
        displayName: `holder-${shortWalletAddress(walletAddress).toLowerCase()}`,
        role: resolveUserRole(walletAddress),
        createdAt: now,
        lastAuthenticatedAt: now
      };
      state.users.push(user);
    } else {
      user.lastAuthenticatedAt = now;
      user.role = resolveUserRole(walletAddress);
    }

    const sessionId = createId("session");
    state.sessions = state.sessions.filter((entry) => entry.userId !== user.id);
    state.sessions.push({
      id: sessionId,
      userId: user.id,
      createdAt: now,
      expiresAt: new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString()
    });
    state.activity.push(
      makeActivity(user, "auth", "Wallet session refreshed", `Signed in as ${user.displayName}.`)
    );

    return { isNewUser, sessionId, user };
  });

  c.header("Set-Cookie", setCookieHeader(cookieName, result.sessionId, sessionMaxAgeSeconds));
  return c.json({
    isNewUser: result.isNewUser,
    user: sanitizeUser(result.user)
  });
});

app.post("/api/auth/logout", async (c) => {
  const state = await db.read();
  const sessionId = parseCookies({ headers: { cookie: c.req.header("cookie") ?? "" } })[cookieName];

  if (sessionId) {
    await db.update((next) => {
      next.sessions = next.sessions.filter((entry) => entry.id !== sessionId);
    });
  }

  c.header("Set-Cookie", clearCookieHeader(cookieName));
  return c.json({
    ok: true,
    remainingUsers: state.users.length
  });
});

app.post("/api/licenses/issue", async (c) => {
  const request = (await c.req.json()) as IssueLicenseRequest;
  const state = await db.read();
  const user = getSessionUser(state, c.req.header("cookie"));
  if (!user) {
    return respondError(c, 401, "Authentication required.");
  }

  let nextBootstrap: BootstrapResponse | null = null;
  let createdIssuance: IssuanceRecord | null = null;

  await db.update(async (draft) => {
    const liveUser = draft.users.find((entry) => entry.id === user.id) as UserRecord;
    const { product, edition } = getProductAndEdition(
      draft,
      request.productId,
      request.editionId
    );

    if (
      draft.issuances.some(
        (entry) =>
          entry.userId === liveUser.id &&
          entry.editionId === edition.id &&
          entry.status === "minted"
      )
    ) {
      throw new Error("This wallet already holds that edition.");
    }

    const availability = getEditionAvailability(edition, draft, liveUser.id);
    if (!availability.canIssue) {
      throw new Error(`Edition unavailable: ${availability.availabilityLabel}.`);
    }

    const configStatus = getLicenseMintConfigStatus();
    const issuance: IssuanceRecord = {
      id: createId("issuance"),
      userId: liveUser.id,
      productId: product.id,
      editionId: edition.id,
      walletAddress: liveUser.walletAddress,
      status: configStatus.enabled ? "submitted" : "blocked",
      createdAt: nowUtc(),
      updatedAt: nowUtc(),
      message: configStatus.enabled ? "Submitting MPL Core license issuance." : configStatus.message,
      collectionAddress: configStatus.collectionAddress
    };
    draft.issuances.push(issuance);
    createdIssuance = issuance;

    if (!configStatus.enabled || !configStatus.collectionAddress) {
      draft.activity.push(
        makeActivity(
          liveUser,
          "issue",
          `${product.name} ${edition.name} blocked`,
          configStatus.message
        )
      );
      nextBootstrap = await buildBootstrap(draft, liveUser);
      return;
    }

    try {
      const publicBaseUrl =
        getEnv("LICENSESHELF_PUBLIC_BASE_URL") ??
        getEnv("STAMPQUEST_PUBLIC_BASE_URL") ??
        `http://localhost:${port}`;
      const metadataUrl = `${publicBaseUrl}/api/licenses/${issuance.id}/metadata.json`;
      const minted = await issueLicenseAsset({
        name: `${product.name} ${edition.name} License`,
        metadataUrl,
        walletAddress: liveUser.walletAddress
      });

      issuance.status = "minted";
      issuance.updatedAt = nowUtc();
      issuance.assetAddress = minted.assetAddress;
      issuance.signature = minted.signature;
      issuance.collectionAddress = minted.collectionAddress;
      issuance.explorerUrls = minted.explorerUrls;
      issuance.message = "License asset minted on devnet.";
      draft.activity.push(
        makeActivity(
          liveUser,
          "issue",
          `${product.name} ${edition.name} minted`,
          `Minted MPL Core asset ${shortWalletAddress(minted.assetAddress)}.`
        )
      );
    } catch (error) {
      issuance.status = "blocked";
      issuance.updatedAt = nowUtc();
      issuance.message =
        error instanceof Error ? error.message : "License issuance failed unexpectedly.";
      draft.activity.push(
        makeActivity(
          liveUser,
          "issue",
          `${product.name} ${edition.name} blocked`,
          issuance.message
        )
      );
    }

    nextBootstrap = await buildBootstrap(draft, liveUser);
  });

  return c.json({
    issuance: createdIssuance,
    bootstrap: nextBootstrap
  });
});

app.post("/api/operator/editions/:editionId", async (c) => {
  const state = await db.read();
  const user = getSessionUser(state, c.req.header("cookie"));
  if (!user || user.role !== "operator") {
    return respondError(c, 403, "Operator access required.");
  }

  const editionId = c.req.param("editionId");
  const body = (await c.req.json()) as EditionInventoryUpdateRequest;

  if (body.supplyCap < 1 || body.reserveCount < 0 || body.reserveCount >= body.supplyCap) {
    return respondError(c, 400, "Supply cap and reserve values are invalid.");
  }

  let bootstrap: BootstrapResponse | null = null;

  await db.update(async (draft) => {
    const liveUser = draft.users.find((entry) => entry.id === user.id) as UserRecord;
    const edition = draft.editions.find((entry) => entry.id === editionId);
    if (!edition) {
      throw new Error("Edition not found.");
    }

    edition.supplyCap = Math.floor(body.supplyCap);
    edition.reserveCount = Math.floor(body.reserveCount);
    edition.status = body.status;

    const product = draft.products.find((entry) => entry.id === edition.productId) as ProductRecord;
    draft.activity.push(
      makeActivity(
        liveUser,
        "operator",
        `Updated ${product.name} ${edition.name}`,
        `Supply ${edition.supplyCap}, reserve ${edition.reserveCount}, status ${edition.status}.`
      )
    );
    bootstrap = await buildBootstrap(draft, liveUser);
  });

  return c.json(bootstrap);
});

app.get("/api/licenses/:issuanceId/metadata.json", async (c) => {
  const issuanceId = c.req.param("issuanceId");
  const state = await db.read();
  const issuance = state.issuances.find((entry) => entry.id === issuanceId);
  if (!issuance) {
    return respondError(c, 404, "Issuance not found.");
  }

  const { product, edition } = getProductAndEdition(state, issuance.productId, issuance.editionId);
  const collectionAddress =
    issuance.collectionAddress ??
    getLicenseMintConfigStatus().collectionAddress ??
    "UNCONFIGURED";

  return c.json(createLicenseMetadata({ collectionAddress, edition, issuance, product }));
});

app.get("/license-art/:editionId.svg", async (c) => {
  const state = await db.read();
  const editionId = c.req.param("editionId");
  const edition = state.editions.find((entry) => entry.id === editionId);
  if (!edition) {
    return new Response("Not found", { status: 404 });
  }

  const product = state.products.find((entry) => entry.id === edition.productId) as ProductRecord;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 628" fill="none">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${product.accent}"/>
      <stop offset="100%" stop-color="#09111d"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="628" rx="36" fill="#02040a"/>
  <rect x="18" y="18" width="1164" height="592" rx="28" fill="url(#g)" opacity="0.95"/>
  <rect x="54" y="54" width="1092" height="520" rx="24" fill="#04101b" fill-opacity="0.82" stroke="rgba(255,255,255,0.14)"/>
  <text x="86" y="140" font-family="Arial, sans-serif" font-size="28" fill="${product.accent}">Nightshift 073</text>
  <text x="86" y="226" font-family="Arial, sans-serif" font-weight="700" font-size="82" fill="#f5f7fb">${product.name}</text>
  <text x="86" y="304" font-family="Arial, sans-serif" font-size="44" fill="#f5f7fb">${edition.name} License</text>
  <text x="86" y="372" font-family="Arial, sans-serif" font-size="28" fill="#a9b7ca">${edition.sku}</text>
  <text x="86" y="466" font-family="Arial, sans-serif" font-size="26" fill="#d6deeb">${edition.shortDescription}</text>
  <text x="86" y="540" font-family="Arial, sans-serif" font-size="24" fill="#7df9c6">Wallet-bound MPL Core entitlement</text>
</svg>`;

  c.header("Content-Type", "image/svg+xml; charset=utf-8");
  return c.body(svg);
});

async function serveStaticAsset(filePath: string) {
  const ext = path.extname(filePath);
  const mimeByExtension: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml; charset=utf-8",
    ".ico": "image/x-icon"
  };

  const contents = await readFile(filePath);
  return new Response(contents, {
    status: 200,
    headers: {
      "Content-Type": mimeByExtension[ext] ?? "application/octet-stream"
    }
  });
}

app.get("*", async (c) => {
  const pathname = c.req.path === "/" ? "/index.html" : c.req.path;
  const staticPath = path.resolve(publicDir, `.${pathname}`);

  if (staticPath.startsWith(publicDir) && existsSync(staticPath)) {
    return serveStaticAsset(staticPath);
  }

  const indexPath = path.resolve(publicDir, "index.html");
  if (existsSync(indexPath)) {
    return serveStaticAsset(indexPath);
  }

  return new Response("Build output not found.", { status: 404 });
});

export { app };

if (getEnv("LICENSESHELF_DISABLE_LISTEN") !== "1") {
  serve({
    fetch: app.fetch,
    port
  });

  console.log(`LicenseShelf server listening on http://localhost:${port}`);
}
