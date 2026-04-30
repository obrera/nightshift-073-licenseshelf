import { createKeyPairSignerFromBytes, devnet } from "@solana/kit";
import { promises as fs } from "node:fs";
import { getEnv } from "../utils.js";

const defaultRpcUrl = "https://api.devnet.solana.com";
const defaultWsUrl = "wss://api.devnet.solana.com";

function parseSecretKey(raw: string): Uint8Array {
  const normalized = raw.trim();

  if (normalized.startsWith("base64:")) {
    return Uint8Array.from(Buffer.from(normalized.slice(7), "base64"));
  }

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    return Uint8Array.from(JSON.parse(normalized) as number[]);
  }

  if (normalized.includes(",")) {
    return Uint8Array.from(
      normalized
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value))
    );
  }

  throw new Error(
    "LICENSESHELF_DEVNET_SIGNER_KEYPAIR must be a keypair path, JSON array, comma-separated list, or base64:value."
  );
}

async function loadSecretKey(raw: string): Promise<Uint8Array> {
  if (
    raw.startsWith("/") ||
    raw.startsWith("./") ||
    raw.startsWith("../") ||
    raw.endsWith(".json")
  ) {
    const contents = await fs.readFile(raw, "utf8");
    return parseSecretKey(contents);
  }

  return parseSecretKey(raw);
}

export interface LicenseMintingConfig {
  publicBaseUrl: string;
  collectionAddress: string;
  rpcUrl: string;
  wsUrl: string;
  signer: Awaited<ReturnType<typeof createKeyPairSignerFromBytes>>;
}

export interface LicenseMintConfigStatusInternal {
  enabled: boolean;
  status: "ready" | "missing_public_base_url" | "missing_signer" | "missing_collection";
  message: string;
  publicBaseUrlConfigured: boolean;
  signerConfigured: boolean;
  collectionConfigured: boolean;
  collectionAddress?: string;
  executionMode: "execute-plugin-aware-collection";
}

function readEnv(name: string, legacyName?: string): string | undefined {
  return getEnv(name) ?? (legacyName ? getEnv(legacyName) : undefined);
}

export function getLicenseMintConfigStatus(): LicenseMintConfigStatusInternal {
  const publicBaseUrl = readEnv("LICENSESHELF_PUBLIC_BASE_URL", "STAMPQUEST_PUBLIC_BASE_URL");
  const signer = readEnv(
    "LICENSESHELF_DEVNET_SIGNER_KEYPAIR",
    "STAMPQUEST_DEVNET_SIGNER_KEYPAIR"
  );
  const collectionAddress = readEnv(
    "LICENSESHELF_EXECUTE_PLUGIN_COLLECTION_ADDRESS",
    "STAMPQUEST_EXECUTE_PLUGIN_COLLECTION_ADDRESS"
  );

  if (!publicBaseUrl) {
    return {
      enabled: false,
      status: "missing_public_base_url",
      message:
        "License issuance is off because LICENSESHELF_PUBLIC_BASE_URL is not configured.",
      publicBaseUrlConfigured: false,
      signerConfigured: Boolean(signer),
      collectionConfigured: Boolean(collectionAddress),
      collectionAddress,
      executionMode: "execute-plugin-aware-collection"
    };
  }

  if (!signer) {
    return {
      enabled: false,
      status: "missing_signer",
      message:
        "License issuance is off because LICENSESHELF_DEVNET_SIGNER_KEYPAIR is not configured.",
      publicBaseUrlConfigured: true,
      signerConfigured: false,
      collectionConfigured: Boolean(collectionAddress),
      collectionAddress,
      executionMode: "execute-plugin-aware-collection"
    };
  }

  if (!collectionAddress) {
    return {
      enabled: false,
      status: "missing_collection",
      message:
        "License issuance is blocked until LICENSESHELF_EXECUTE_PLUGIN_COLLECTION_ADDRESS points at an execute-plugin-enabled MPL Core collection.",
      publicBaseUrlConfigured: true,
      signerConfigured: true,
      collectionConfigured: false,
      executionMode: "execute-plugin-aware-collection"
    };
  }

  return {
    enabled: true,
    status: "ready",
    message:
      "License issuance is ready and will mint into the configured execute-plugin-aware collection.",
    publicBaseUrlConfigured: true,
    signerConfigured: true,
    collectionConfigured: true,
    collectionAddress,
    executionMode: "execute-plugin-aware-collection"
  };
}

export async function getLicenseMintingConfig(): Promise<LicenseMintingConfig> {
  const status = getLicenseMintConfigStatus();
  if (!status.enabled || !status.collectionAddress) {
    throw new Error(status.message);
  }

  const secret = await loadSecretKey(
    readEnv("LICENSESHELF_DEVNET_SIGNER_KEYPAIR", "STAMPQUEST_DEVNET_SIGNER_KEYPAIR")!
  );

  return {
    publicBaseUrl: readEnv("LICENSESHELF_PUBLIC_BASE_URL", "STAMPQUEST_PUBLIC_BASE_URL")!,
    collectionAddress: status.collectionAddress,
    rpcUrl: readEnv("LICENSESHELF_DEVNET_RPC_URL", "STAMPQUEST_DEVNET_RPC_URL") ?? defaultRpcUrl,
    wsUrl: readEnv("LICENSESHELF_DEVNET_WS_URL", "STAMPQUEST_DEVNET_WS_URL") ?? defaultWsUrl,
    signer: await createKeyPairSignerFromBytes(secret, false)
  };
}
