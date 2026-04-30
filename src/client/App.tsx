import {
  type UiWallet,
  WalletUiIcon,
  useSignIn,
  useSignMessage,
  useWalletUi,
  useWalletUiWallet
} from "@wallet-ui/react";
import { useEffect, useState } from "react";
import type {
  BootstrapResponse,
  EditionInventoryUpdateRequest,
  EditionStatus
} from "../shared/contracts";
import { handleSiwsAuth, handleSiwsAuthWithSignMessage } from "./handle-siws-auth";

type TabId = "shelf" | "vault" | "operator";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }
  return data;
}

function formatUtc(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function shortAddress(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function WalletConnectOption({ busy, wallet }: { busy: boolean; wallet: UiWallet }) {
  const { connect, isConnecting } = useWalletUiWallet({ wallet });

  return (
    <button
      className="button ghost wallet-option"
      disabled={busy || isConnecting}
      onClick={() => void connect()}
      type="button"
    >
      <WalletUiIcon className="wallet-icon" wallet={wallet} />
      <span>{isConnecting ? `Connecting ${wallet.name}...` : `Connect ${wallet.name}`}</span>
    </button>
  );
}

function WalletSignInOption({
  onError,
  onNotice,
  refresh,
  wallet
}: {
  onError: (value: string | null) => void;
  onNotice: (value: string | null) => void;
  refresh: () => Promise<void>;
  wallet: UiWallet;
}) {
  const account = wallet.accounts?.[0];
  const signIn = useSignIn(wallet);
  const [isBusy, setIsBusy] = useState(false);

  if (!account) {
    return null;
  }

  return (
    <button
      className="button primary wallet-option"
      disabled={isBusy}
      onClick={() => {
        onError(null);
        onNotice(null);
        setIsBusy(true);
        void handleSiwsAuth({
          address: account.address,
          refresh,
          signIn,
          statement: "Sign in to LicenseShelf with your Solana wallet."
        })
          .then((result) => {
            onNotice(result.isNewUser ? "Wallet connected. Shelf account created." : "Wallet session refreshed.");
          })
          .catch((reason: unknown) => {
            onError(reason instanceof Error ? reason.message : "Wallet sign-in failed.");
          })
          .finally(() => {
            setIsBusy(false);
          });
      }}
      type="button"
    >
      <WalletUiIcon className="wallet-icon" wallet={wallet} />
      <span>{isBusy ? `Signing With ${wallet.name}...` : `Sign In With ${wallet.name}`}</span>
    </button>
  );
}

function WalletMessageSignInOption({
  onError,
  onNotice,
  refresh,
  wallet
}: {
  onError: (value: string | null) => void;
  onNotice: (value: string | null) => void;
  refresh: () => Promise<void>;
  wallet: UiWallet;
}) {
  const account = wallet.accounts?.[0];
  const [isBusy, setIsBusy] = useState(false);
  const signMessage = useSignMessage(account);

  if (!account) {
    return null;
  }

  return (
    <button
      className="button primary wallet-option"
      disabled={isBusy}
      onClick={() => {
        onError(null);
        onNotice(null);
        setIsBusy(true);
        void handleSiwsAuthWithSignMessage({
          address: account.address,
          refresh,
          signMessage: async (message) =>
            signMessage({
              message
            }),
          statement: "Sign in to LicenseShelf with your Solana wallet."
        })
          .then((result) => {
            onNotice(result.isNewUser ? "Wallet connected. Shelf account created." : "Wallet session refreshed.");
          })
          .catch((reason: unknown) => {
            onError(reason instanceof Error ? reason.message : "Wallet sign-in failed.");
          })
          .finally(() => {
            setIsBusy(false);
          });
      }}
      type="button"
    >
      <WalletUiIcon className="wallet-icon" wallet={wallet} />
      <span>{isBusy ? `Signing With ${wallet.name}...` : `Fallback Sign-In With ${wallet.name}`}</span>
    </button>
  );
}

export function App() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("shelf");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [inventoryDrafts, setInventoryDrafts] = useState<
    Record<string, { supplyCap: string; reserveCount: string; status: EditionStatus }>
  >({});

  const { account, disconnect, wallets } = useWalletUi();
  const connectedWalletAddress = account?.address ?? "";
  const user = bootstrap?.session.user ?? null;
  const products = bootstrap?.products ?? [];
  const entitlements = bootstrap?.entitlements;
  const operatorOverview = bootstrap?.operatorOverview;
  const selectedProduct =
    products.find((entry) => entry.id === selectedProductId) ?? products[0] ?? null;
  const hasWalletMismatch = Boolean(
    user && connectedWalletAddress && connectedWalletAddress !== user.walletAddress
  );

  async function refresh() {
    const data = await api<BootstrapResponse>("/api/bootstrap");
    setBootstrap(data);
  }

  useEffect(() => {
    void refresh().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Failed to load LicenseShelf.");
    });
  }, []);

  useEffect(() => {
    if (!selectedProductId && products[0]) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  useEffect(() => {
    if (user?.role !== "operator" && tab === "operator") {
      setTab("shelf");
    }
  }, [tab, user?.role]);

  useEffect(() => {
    if (!operatorOverview) {
      return;
    }

    setInventoryDrafts((current) => {
      const next = { ...current };
      for (const edition of operatorOverview.editions) {
        if (!next[edition.editionId]) {
          next[edition.editionId] = {
            supplyCap: String(edition.supplyCap),
            reserveCount: String(edition.reserveCount),
            status: edition.status
          };
        }
      }
      return next;
    });
  }, [operatorOverview]);

  async function logout() {
    setBusyKey("logout");
    setError(null);
    try {
      await api("/api/auth/logout", { method: "POST" });
      await refresh();
      setNotice("Signed out.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Logout failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function issueEdition(productId: string, editionId: string) {
    setBusyKey(`issue:${editionId}`);
    setError(null);
    setNotice(null);

    try {
      const response = await api<{ bootstrap: BootstrapResponse }>("/api/licenses/issue", {
        method: "POST",
        body: JSON.stringify({ productId, editionId })
      });
      setBootstrap(response.bootstrap);
      const latest = response.bootstrap.entitlements.history[0];
      if (latest?.signature) {
        setNotice(`License issued. Tx ${shortAddress(latest.signature)} captured on devnet.`);
      } else {
        setNotice(latest?.verificationMessage ?? "Issuance attempt recorded.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Issue flow failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveInventory(editionId: string) {
    const draft = inventoryDrafts[editionId];
    if (!draft) {
      return;
    }

    setBusyKey(`operator:${editionId}`);
    setError(null);
    setNotice(null);

    try {
      const body: EditionInventoryUpdateRequest = {
        supplyCap: Number(draft.supplyCap),
        reserveCount: Number(draft.reserveCount),
        status: draft.status
      };
      const next = await api<BootstrapResponse>(`/api/operator/editions/${editionId}`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      setBootstrap(next);
      setNotice("Operator inventory updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Operator update failed.");
    } finally {
      setBusyKey(null);
    }
  }

  if (!bootstrap) {
    return (
      <main className="app-shell loading-shell">
        <div className="backdrop orb-a" />
        <div className="backdrop orb-b" />
        <section className="panel loading-card">
          <p className="eyebrow">Nightshift 073</p>
          <h1>LicenseShelf</h1>
          <p className="muted">Loading product shelf, entitlement index, and operator state.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="backdrop orb-a" />
      <div className="backdrop orb-b" />
      <div className="backdrop orb-c" />

      <section className="hero panel">
        <div className="hero-copy">
          <p className="eyebrow">Nightshift Build 073</p>
          <h1>LicenseShelf</h1>
          <p className="lede">
            A public shelf of digital product editions with wallet-native issuance, MPL Core entitlement checks,
            and an operator console that manages real devnet inventory.
          </p>
          <div className="hero-chips">
            <span>Consumer shelf</span>
            <span>SIWS auth</span>
            <span>Devnet MPL Core</span>
            <span>Single-domain deploy</span>
          </div>
        </div>
        <div className="hero-status panel inset">
          <p className="eyebrow">Runtime</p>
          <div className="stack compact">
            <div>
              <strong>Mint path</strong>
              <p className="muted">{bootstrap.configStatus.message}</p>
            </div>
            <div>
              <strong>Connected wallet</strong>
              <p className="muted">
                {connectedWalletAddress ? shortAddress(connectedWalletAddress) : "No wallet connected"}
              </p>
            </div>
            <div>
              <strong>Session</strong>
              <p className="muted">{user ? `${user.displayName} (${user.role})` : "Anonymous browser"}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="topbar">
        <div className="tab-row">
          {(["shelf", "vault"] as TabId[]).map((entry) => (
            <button
              key={entry}
              className={`button tab ${tab === entry ? "active" : ""}`}
              onClick={() => setTab(entry)}
              type="button"
            >
              {entry === "shelf" ? "Shelf" : "Entitlements"}
            </button>
          ))}
          {user?.role === "operator" ? (
            <button
              className={`button tab ${tab === "operator" ? "active" : ""}`}
              onClick={() => setTab("operator")}
              type="button"
            >
              Operator
            </button>
          ) : null}
        </div>
        <div className="session-row">
          {user ? (
            <>
              <div className="identity">
                <span>{user.displayName}</span>
                <small>{shortAddress(user.walletAddress)}</small>
              </div>
              <button
                className="button ghost"
                disabled={busyKey === "logout"}
                onClick={() => void logout()}
                type="button"
              >
                {busyKey === "logout" ? "Signing Out..." : "Sign Out"}
              </button>
              {connectedWalletAddress ? (
                <button
                  className="button ghost"
                  disabled={disconnecting}
                  onClick={() => {
                    setDisconnecting(true);
                    try {
                      disconnect();
                    } finally {
                      setDisconnecting(false);
                    }
                  }}
                  type="button"
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect Wallet"}
                </button>
              ) : null}
            </>
          ) : (
            <div className="identity anonymous">
              <span>Public shelf mode</span>
              <small>Connect and sign in to issue a license.</small>
            </div>
          )}
        </div>
      </section>

      {error ? <section className="notice error">{error}</section> : null}
      {notice ? <section className="notice success">{notice}</section> : null}
      {hasWalletMismatch ? (
        <section className="notice warn">
          Connected wallet differs from the authenticated wallet session. Issuance follows the signed-in wallet.
        </section>
      ) : null}

      {!user ? (
        <section className="panel auth-card">
          <p className="eyebrow">Wallet First</p>
          <h2>Connect, then sign in with SIWS.</h2>
          <p className="muted">
            All issue flows mint to the connected and authenticated wallet directly. No pasted destination field.
          </p>
          <div className="wallet-grid">
            {wallets.length === 0 ? <p className="muted">No compatible wallets detected.</p> : null}
            {wallets.map((wallet) => (
              <WalletConnectOption busy={Boolean(busyKey)} key={`connect:${wallet.name}`} wallet={wallet} />
            ))}
            {wallets.map((wallet) => {
              const supportsNativeSignIn = Boolean(
                wallet.features && "solana:signIn" in wallet.features
              );

              if (!supportsNativeSignIn) {
                return null;
              }

              return (
                <WalletSignInOption
                  key={`signin:${wallet.name}`}
                  onError={setError}
                  onNotice={setNotice}
                  refresh={refresh}
                  wallet={wallet}
                />
              );
            })}
            {wallets.map((wallet) => (
              <WalletMessageSignInOption
                key={`message:${wallet.name}`}
                onError={setError}
                onNotice={setNotice}
                refresh={refresh}
                wallet={wallet}
              />
            ))}
          </div>
        </section>
      ) : null}

      {tab === "shelf" ? (
        <section className="content-grid">
          <aside className="panel shelf-list">
            <div className="section-head">
              <div>
                <p className="eyebrow">Public Shelf</p>
                <h2>Products</h2>
              </div>
              <p className="muted">{products.length} seeded drops</p>
            </div>
            <div className="stack">
              {products.map((product) => (
                <button
                  key={product.id}
                  className={`product-card ${selectedProduct?.id === product.id ? "active" : ""}`}
                  onClick={() => setSelectedProductId(product.id)}
                  type="button"
                >
                  <span className="product-label">{product.heroLabel}</span>
                  <strong>{product.name}</strong>
                  <p>{product.tagline}</p>
                </button>
              ))}
            </div>
          </aside>

          {selectedProduct ? (
            <section className="panel product-detail">
              <div className="section-head">
                <div>
                  <p className="eyebrow">{selectedProduct.category}</p>
                  <h2>{selectedProduct.name}</h2>
                </div>
                <span className="accent-chip">{selectedProduct.heroLabel}</span>
              </div>
              <p className="lede">{selectedProduct.summary}</p>
              <p className="muted">{selectedProduct.story}</p>

              <div className="feature-row">
                {selectedProduct.features.map((feature) => (
                  <span key={feature}>{feature}</span>
                ))}
              </div>

              <div className="edition-grid">
                {selectedProduct.editions.map((edition) => (
                  <article className="edition-card" key={edition.id}>
                    <div className="edition-head">
                      <div>
                        <p className="eyebrow">{edition.sku}</p>
                        <h3>{edition.name}</h3>
                      </div>
                      <span className="availability">{edition.availabilityLabel}</span>
                    </div>
                    <p>{edition.shortDescription}</p>
                    <p className="muted">{edition.longDescription}</p>
                    <p className="price">{edition.priceLabel}</p>
                    <div className="perk-list">
                      {edition.perks.map((perk) => (
                        <span key={perk}>{perk}</span>
                      ))}
                    </div>
                    <div className="edition-meta">
                      <small>{edition.issuedCount} issued</small>
                      <small>{edition.mintedCount} minted</small>
                      <small>{edition.remainingSupply} remaining</small>
                    </div>
                    <button
                      className="button primary full"
                      disabled={!user || !edition.canIssue || busyKey === `issue:${edition.id}`}
                      onClick={() => void issueEdition(selectedProduct.id, edition.id)}
                      type="button"
                    >
                      {!user
                        ? "Sign In To Issue"
                        : busyKey === `issue:${edition.id}`
                          ? "Issuing..."
                          : edition.userHasMinted
                            ? "Already Issued"
                            : "Issue Devnet License"}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

      {tab === "vault" ? (
        <section className="content-grid single">
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Entitlement Checker</p>
                <h2>Wallet Holdings</h2>
              </div>
              <span className="accent-chip">
                {entitlements?.walletAddress ? shortAddress(entitlements.walletAddress) : "No session"}
              </span>
            </div>
            <p className="muted">{entitlements?.collectionStatus}</p>
            <div className="stack">
              {entitlements?.holdings.length ? (
                entitlements.holdings.map((item) => (
                  <article className="history-card" key={item.issuanceId}>
                    <div className="history-head">
                      <div>
                        <strong>{item.productName}</strong>
                        <p className="muted">{item.editionName}</p>
                      </div>
                      <span className={`status-pill ${item.verificationStatus}`}>{item.verificationStatus}</span>
                    </div>
                    <p className="muted">{item.verificationMessage}</p>
                    <div className="history-links">
                      <small>{formatUtc(item.issuedAt)}</small>
                      {item.assetAddress ? <small>Asset {shortAddress(item.assetAddress)}</small> : null}
                      {item.signature ? <small>Tx {shortAddress(item.signature)}</small> : null}
                    </div>
                    <div className="history-links">
                      {item.explorerUrls?.asset ? (
                        <a href={item.explorerUrls.asset} rel="noreferrer" target="_blank">
                          Asset
                        </a>
                      ) : null}
                      {item.explorerUrls?.transaction ? (
                        <a href={item.explorerUrls.transaction} rel="noreferrer" target="_blank">
                          Transaction
                        </a>
                      ) : null}
                      {item.explorerUrls?.collection ? (
                        <a href={item.explorerUrls.collection} rel="noreferrer" target="_blank">
                          Collection
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <p className="muted">No verified holdings yet.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Issue History</p>
                <h2>Recent Attempts</h2>
              </div>
            </div>
            <div className="stack">
              {entitlements?.history.length ? (
                entitlements.history.map((item) => (
                  <article className="history-card" key={`history:${item.issuanceId}`}>
                    <div className="history-head">
                      <div>
                        <strong>{item.productName}</strong>
                        <p className="muted">{item.editionName}</p>
                      </div>
                      <span className={`status-pill ${item.status}`}>{item.status}</span>
                    </div>
                    <p className="muted">{item.verificationMessage}</p>
                    <small>{formatUtc(item.issuedAt)}</small>
                  </article>
                ))
              ) : (
                <p className="muted">No issuance history recorded for this wallet yet.</p>
              )}
            </div>
          </section>
        </section>
      ) : null}

      {tab === "operator" && operatorOverview ? (
        <section className="content-grid single">
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Operator Edition Console</p>
                <h2>Inventory And Readiness</h2>
              </div>
              <span className="accent-chip">
                {operatorOverview.totalMinted} minted / {operatorOverview.totalIssued} issued
              </span>
            </div>
            <p className="muted">{operatorOverview.readinessMessage}</p>

            <div className="operator-grid">
              {operatorOverview.editions.map((edition) => {
                const draft = inventoryDrafts[edition.editionId];
                return (
                  <article className="edition-card operator-card" key={edition.editionId}>
                    <div className="edition-head">
                      <div>
                        <p className="eyebrow">{edition.productName}</p>
                        <h3>{edition.editionName}</h3>
                      </div>
                      <span className="availability">{edition.remainingSupply} remaining</span>
                    </div>
                    <div className="operator-metrics">
                      <small>{edition.issuedCount} issued</small>
                      <small>{edition.mintedCount} minted</small>
                      <small>Status: {edition.status}</small>
                    </div>
                    <label>
                      <span>Supply cap</span>
                      <input
                        onChange={(event) =>
                          setInventoryDrafts((current) => ({
                            ...current,
                            [edition.editionId]: {
                              ...(current[edition.editionId] ?? {
                                supplyCap: "",
                                reserveCount: "",
                                status: edition.status
                              }),
                              supplyCap: event.target.value
                            }
                          }))
                        }
                        type="number"
                        value={draft?.supplyCap ?? ""}
                      />
                    </label>
                    <label>
                      <span>Reserve count</span>
                      <input
                        onChange={(event) =>
                          setInventoryDrafts((current) => ({
                            ...current,
                            [edition.editionId]: {
                              ...(current[edition.editionId] ?? {
                                supplyCap: "",
                                reserveCount: "",
                                status: edition.status
                              }),
                              reserveCount: event.target.value
                            }
                          }))
                        }
                        type="number"
                        value={draft?.reserveCount ?? ""}
                      />
                    </label>
                    <label>
                      <span>Status</span>
                      <select
                        className="select"
                        onChange={(event) =>
                          setInventoryDrafts((current) => ({
                            ...current,
                            [edition.editionId]: {
                              ...(current[edition.editionId] ?? {
                                supplyCap: "",
                                reserveCount: "",
                                status: edition.status
                              }),
                              status: event.target.value as EditionStatus
                            }
                          }))
                        }
                        value={draft?.status ?? edition.status}
                      >
                        <option value="live">live</option>
                        <option value="paused">paused</option>
                        <option value="sold_out">sold_out</option>
                      </select>
                    </label>
                    <button
                      className="button primary full"
                      disabled={busyKey === `operator:${edition.editionId}`}
                      onClick={() => void saveInventory(edition.editionId)}
                      type="button"
                    >
                      {busyKey === `operator:${edition.editionId}` ? "Saving..." : "Save Inventory"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Audit Stream</p>
                <h2>Recent Activity</h2>
              </div>
            </div>
            <div className="stack">
              {operatorOverview.recentActivity.map((entry) => (
                <article className="history-card" key={entry.id}>
                  <div className="history-head">
                    <div>
                      <strong>{entry.headline}</strong>
                      <p className="muted">{entry.detail}</p>
                    </div>
                    <span className={`status-pill ${entry.kind}`}>{entry.kind}</span>
                  </div>
                  <small>
                    {entry.userDisplayName} • {formatUtc(entry.createdAt)}
                  </small>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : null}
    </main>
  );
}
