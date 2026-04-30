import type { ActivityRecord, AppState, EditionRecord, ProductRecord } from "../shared/contracts.js";

function buildProducts(): ProductRecord[] {
  return [
    {
      id: "prod_founder_toolkit",
      slug: "founder-toolkit",
      name: "Founder Toolkit",
      category: "Launch Asset",
      heroLabel: "Shelf Drop 01",
      tagline: "A launch license for teams shipping fast demos without losing ownership trails.",
      summary:
        "LicenseShelf packages devnet-native launch rights into clear editions for builders, backers, and operator teams.",
      story:
        "Founder Toolkit is the flagship shelf item for Solana Week: a digital launch pack with a provable MPL Core license asset attached to the holder wallet.",
      accent: "#7df9c6",
      features: [
        "Operator-issued devnet license asset",
        "Edition-specific support and seat signal",
        "Wallet-bound proof for entitlement checks"
      ]
    },
    {
      id: "prod_aftercare_pass",
      slug: "aftercare-pass",
      name: "Aftercare Pass",
      category: "Support Access",
      heroLabel: "Shelf Drop 02",
      tagline: "Post-demo recovery rights for teams that need office-hours coverage after the event.",
      summary:
        "A support-oriented product tiered for async follow-up, issue triage, and release readiness sessions.",
      story:
        "The Aftercare Pass keeps the shelf from feeling like merch. It behaves like a support entitlement product with verifiable issue history.",
      accent: "#f7b955",
      features: [
        "Wallet-owned support pass",
        "Tiered readiness promises",
        "Operator-tracked supply and issuance ledger"
      ]
    },
    {
      id: "prod_retail_pack",
      slug: "retail-pack",
      name: "Retail Pack",
      category: "IRL Activation",
      heroLabel: "Shelf Drop 03",
      tagline: "A consumer-facing bundle for pop-up retail teams running limited digital drops.",
      summary:
        "Designed for storefront teams that want wallet-native proofs for booths, drops, and temporary entitlement windows.",
      story:
        "Retail Pack rounds out the shelf with a more consumer-forward posture: visibly tiered, finite, and easy to verify from a connected wallet.",
      accent: "#8ca7ff",
      features: [
        "Public shelf presentation",
        "Finite edition inventory",
        "Immediate entitlement verification"
      ]
    }
  ];
}

function buildEditions(): EditionRecord[] {
  return [
    {
      id: "edition_founder_signal",
      productId: "prod_founder_toolkit",
      name: "Signal",
      sku: "LCS-073-SIG",
      shortDescription: "Fast-track launch rights for solo builders.",
      longDescription: "Single-holder license edition for founders who need a straightforward, wallet-bound launch entitlement.",
      priceLabel: "Free issue",
      perks: ["Devnet MPL Core license", "Single founder seat", "Issue history tracking"],
      supplyCap: 40,
      reserveCount: 3,
      status: "live",
      sortOrder: 1
    },
    {
      id: "edition_founder_pulse",
      productId: "prod_founder_toolkit",
      name: "Pulse",
      sku: "LCS-073-PLS",
      shortDescription: "Higher-touch edition with operator readiness review.",
      longDescription: "A richer launch tier for teams that want the license plus a tracked readiness posture inside the operator console.",
      priceLabel: "Operator issue",
      perks: ["Priority issuance", "Readiness review", "Mint audit trail"],
      supplyCap: 16,
      reserveCount: 2,
      status: "live",
      sortOrder: 2
    },
    {
      id: "edition_aftercare_patch",
      productId: "prod_aftercare_pass",
      name: "Patch",
      sku: "LCS-073-PTC",
      shortDescription: "Base support entitlement for follow-up fixes.",
      longDescription: "The Patch edition is meant for practical support coverage after a demo or live install.",
      priceLabel: "Free issue",
      perks: ["Async support window", "Wallet-first entitlement check", "Durable issuance record"],
      supplyCap: 60,
      reserveCount: 5,
      status: "live",
      sortOrder: 1
    },
    {
      id: "edition_aftercare_nightops",
      productId: "prod_aftercare_pass",
      name: "Night Ops",
      sku: "LCS-073-NOP",
      shortDescription: "Escalation-friendly support tier for launch crews.",
      longDescription: "Night Ops includes the same asset primitive with tighter supply and better operator visibility.",
      priceLabel: "Operator issue",
      perks: ["Escalation lane", "Limited run", "Audit-ready operator notes"],
      supplyCap: 12,
      reserveCount: 2,
      status: "live",
      sortOrder: 2
    },
    {
      id: "edition_retail_window",
      productId: "prod_retail_pack",
      name: "Window",
      sku: "LCS-073-WND",
      shortDescription: "Entry edition for retail drop operators.",
      longDescription: "Window is the approachable edition for public-facing teams that still want real wallet-based proof of holding.",
      priceLabel: "Free issue",
      perks: ["Retail-ready drop asset", "Public shelf listing", "On-chain verification"],
      supplyCap: 32,
      reserveCount: 4,
      status: "live",
      sortOrder: 1
    },
    {
      id: "edition_retail_marquee",
      productId: "prod_retail_pack",
      name: "Marquee",
      sku: "LCS-073-MRQ",
      shortDescription: "Premium storefront edition with tighter inventory.",
      longDescription: "Marquee is the visibly scarce edition for storefront teams running headline drops during Solana Week.",
      priceLabel: "Operator issue",
      perks: ["Scarcer inventory", "Premium storefront tag", "Wallet-native provenance"],
      supplyCap: 8,
      reserveCount: 1,
      status: "live",
      sortOrder: 2
    }
  ];
}

export function createSeedState(): AppState {
  return {
    version: 73,
    users: [],
    sessions: [],
    authChallenges: [],
    products: buildProducts(),
    editions: buildEditions(),
    issuances: [],
    activity: [] satisfies ActivityRecord[]
  };
}
