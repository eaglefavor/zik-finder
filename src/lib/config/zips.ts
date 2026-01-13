/**
 * ZIPS 4.0 (ZikLodge Intelligent Pricing System)
 * Central Configuration for Monetization & Integrity
 */

export const ZIPS_CONFIG = {
  // Exchange Rate
  CREDIT_VALUE_NAIRA: 100, // 1 Z-Credit = ₦100

  // Verification Cost
  VERIFICATION_FEE_NAIRA: 2500,

  // Credit Bundles
  BUNDLES: [
    { name: 'Starter Pack', price: 5000, credits: 50, bonus: 0 },
    { name: 'Agent Killer', price: 10000, credits: 110, bonus: 10 }, // 10 Bonus Credits
    { name: 'Tycoon Pack', price: 20000, credits: 230, bonus: 30 },  // 30 Bonus Credits
  ],

  // Lead Scoring Logic (Student Budget -> Credits Cost)
  LEAD_TIERS: {
    STANDARD: { max_budget: 299999, cost: 10 },   // ₦1,000
    HIGH_VALUE: { max_budget: 699999, cost: 15 }, // ₦1,500
    PREMIUM: { min_budget: 700000, cost: 20 }     // ₦2,000
  },

  // Z-Score Reputation Engine
  Z_SCORE: {
    STARTING: 50,
    SHADOWBAN_THRESHOLD: 30, // Listings pushed to bottom/hidden
    BAN_THRESHOLD: 0,        // Account suspension
    
    // Points System
    POINTS: {
      PURCHASE_BUNDLE: 5,
      UNLOCK_LEAD: 2,
      GET_VERIFIED: 20,
      POSITIVE_REVIEW: 5,
      REPORT_RUDE: -5,
      REPORT_MISLEADING: -20,
      REPORT_SCAM: -100
    }
  },

  // Integrity Thresholds
  INTEGRITY: {
    SILENT_FLAG_PRICE_DROP: 0.25, // 25% drop triggers silent flag
    VERIFY_REVOKE_PRICE_EDIT: 0.30, // 30% edit loses verified badge
    VERIFY_REVOKE_IMAGE_EDIT: 0.50, // 50% image change loses badge
  }
};

/**
 * Calculates the credit cost to unlock a student based on their budget.
 */
export const getLeadCreditCost = (budget: number): number => {
  if (budget >= ZIPS_CONFIG.LEAD_TIERS.PREMIUM.min_budget) {
    return ZIPS_CONFIG.LEAD_TIERS.PREMIUM.cost;
  }
  if (budget > ZIPS_CONFIG.LEAD_TIERS.STANDARD.max_budget) {
    return ZIPS_CONFIG.LEAD_TIERS.HIGH_VALUE.cost;
  }
  return ZIPS_CONFIG.LEAD_TIERS.STANDARD.cost;
};
