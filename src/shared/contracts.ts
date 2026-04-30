export const BUILD_NUMBER = 73;

export type UserRole = "operator" | "customer";
export type EditionStatus = "live" | "paused" | "sold_out";
export type IssuanceStatus = "blocked" | "submitted" | "minted";
export type VerificationStatus =
  | "verified_on_chain"
  | "recorded_locally"
  | "missing_collection_config"
  | "not_found_on_chain";

export interface UserRecord {
  id: string;
  walletAddress: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  lastAuthenticatedAt: string;
}

export interface UserSummary {
  id: string;
  walletAddress: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  lastAuthenticatedAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuthChallengeRecord {
  id: string;
  walletAddress: string;
  nonce: string;
  domain: string;
  uri: string;
  chainId: string;
  statement: string;
  issuedAt: string;
  expirationTime: string;
  createdAt: string;
  expiresAt: string;
}

export interface ProductRecord {
  id: string;
  slug: string;
  name: string;
  category: string;
  heroLabel: string;
  tagline: string;
  summary: string;
  story: string;
  accent: string;
  features: string[];
}

export interface EditionRecord {
  id: string;
  productId: string;
  name: string;
  sku: string;
  shortDescription: string;
  longDescription: string;
  priceLabel: string;
  perks: string[];
  supplyCap: number;
  reserveCount: number;
  status: EditionStatus;
  sortOrder: number;
}

export interface ExplorerUrls {
  asset: string;
  collection: string;
  transaction: string;
}

export interface IssuanceRecord {
  id: string;
  userId: string;
  productId: string;
  editionId: string;
  walletAddress: string;
  status: IssuanceStatus;
  createdAt: string;
  updatedAt: string;
  message: string;
  collectionAddress?: string;
  assetAddress?: string;
  signature?: string;
  explorerUrls?: ExplorerUrls;
}

export interface ActivityRecord {
  id: string;
  userId: string;
  userDisplayName: string;
  kind: "auth" | "issue" | "operator";
  headline: string;
  detail: string;
  createdAt: string;
}

export interface AppState {
  version: 73;
  users: UserRecord[];
  sessions: SessionRecord[];
  authChallenges: AuthChallengeRecord[];
  products: ProductRecord[];
  editions: EditionRecord[];
  issuances: IssuanceRecord[];
  activity: ActivityRecord[];
}

export interface SolanaAuthNonceRequest {
  walletAddress: string;
}

export interface SolanaAuthNonceResponse {
  walletAddress: string;
  nonce: string;
  domain: string;
  uri: string;
  version: "1";
  issuedAt: string;
  expirationTime: string;
  chainId: string;
  statement: string;
}

export interface SolanaAuthVerifyRequest {
  walletAddress: string;
  signature: string;
  message: string;
}

export interface IssueLicenseRequest {
  productId: string;
  editionId: string;
}

export interface EditionInventoryUpdateRequest {
  supplyCap: number;
  reserveCount: number;
  status: EditionStatus;
}

export interface LicenseMintConfigStatus {
  enabled: boolean;
  status: "ready" | "missing_public_base_url" | "missing_signer" | "missing_collection";
  message: string;
  publicBaseUrlConfigured: boolean;
  signerConfigured: boolean;
  collectionConfigured: boolean;
  collectionAddress?: string;
  executionMode: "execute-plugin-aware-collection";
}

export interface EditionView extends EditionRecord {
  issuedCount: number;
  mintedCount: number;
  remainingSupply: number;
  userHasMinted: boolean;
  canIssue: boolean;
  availabilityLabel: string;
}

export interface ProductView extends ProductRecord {
  editions: EditionView[];
}

export interface EntitlementItem {
  issuanceId: string;
  productName: string;
  editionName: string;
  walletAddress: string;
  issuedAt: string;
  status: IssuanceStatus;
  verificationStatus: VerificationStatus;
  verificationMessage: string;
  assetAddress?: string;
  signature?: string;
  explorerUrls?: ExplorerUrls;
}

export interface EntitlementSummary {
  walletAddress?: string;
  holdings: EntitlementItem[];
  history: EntitlementItem[];
  collectionStatus: string;
}

export interface OperatorEditionSummary {
  editionId: string;
  productName: string;
  editionName: string;
  status: EditionStatus;
  supplyCap: number;
  reserveCount: number;
  issuedCount: number;
  mintedCount: number;
  remainingSupply: number;
}

export interface OperatorOverview {
  totalProducts: number;
  totalEditions: number;
  totalIssued: number;
  totalMinted: number;
  readinessMessage: string;
  recentActivity: ActivityRecord[];
  editions: OperatorEditionSummary[];
}

export interface BootstrapResponse {
  buildNumber: 73;
  session: {
    user: UserSummary | null;
  };
  configStatus: LicenseMintConfigStatus;
  products: ProductView[];
  entitlements: EntitlementSummary;
  operatorOverview: OperatorOverview | null;
}
