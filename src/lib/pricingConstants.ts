/**
 * PatentBot AI™ Pricing & Business Constants
 * 
 * Single source of truth for all pricing, valuation, and business constants.
 * Update here to change across the entire application.
 */

// ===== PRODUCT PRICING =====

/** Patent Application one-time fee (in cents for Stripe) */
export const PATENT_APPLICATION_PRICE_CENTS = 100000; // $1,000.00

/** Patent Application one-time fee (display value) */
export const PATENT_APPLICATION_PRICE = 1000;

/** Check & See monthly subscription (in cents for Stripe) */
export const CHECK_AND_SEE_PRICE_CENTS = 999; // $9.99

/** Check & See monthly subscription (display value) */
export const CHECK_AND_SEE_PRICE = 9.99;

// ===== STRIPE PRICE IDs =====

/** Stripe Price ID for Patent Application one-time payment */
export const STRIPE_PATENT_APPLICATION_PRICE_ID = 'price_1RdXGjKFoovQj4C2M0KxKh8B';

/** Stripe Price ID for Check & See subscription */
export const STRIPE_CHECK_AND_SEE_PRICE_ID = 'price_1RdXHaKFoovQj4C2Vx8MmN3P';

// ===== FORMATTED DISPLAY STRINGS =====

/** Formatted patent application price for display */
export const PATENT_APPLICATION_PRICE_DISPLAY = '$1,000';

/** Formatted Check & See price for display */
export const CHECK_AND_SEE_PRICE_DISPLAY = '$9.99';

/** Formatted Check & See price with period */
export const CHECK_AND_SEE_PRICE_DISPLAY_MONTHLY = '$9.99/month';

/** Formatted Check & See price with short period */
export const CHECK_AND_SEE_PRICE_DISPLAY_MO = '$9.99/mo';

// ===== PATENT VALUATION =====

/** Estimated value per active patent (for portfolio valuation) */
export const PATENT_VALUE_ESTIMATE = 125000; // $125,000

/** Patent term in years from grant date */
export const PATENT_TERM_YEARS = 20;

// ===== FREE TIER LIMITS =====

/** Number of free prior art searches allowed */
export const FREE_SEARCHES_LIMIT = 3;

// ===== SIMILARITY THRESHOLDS =====

/** Threshold for "high similarity" classification (0-1) */
export const HIGH_SIMILARITY_THRESHOLD = 0.7;

// ===== MAINTENANCE THRESHOLDS =====

/** Months before maintenance is considered "due soon" */
export const MAINTENANCE_DUE_SOON_MONTHS = 6;

// ===== FORMATTING HELPERS =====

/**
 * Format a price for display with dollar sign
 */
export const formatPrice = (cents: number): string => {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Format a dollar amount for display
 */
export const formatDollars = (dollars: number): string => {
  return `$${dollars.toLocaleString('en-US')}`;
};

/**
 * Calculate portfolio value based on active patents
 */
export const calculatePortfolioValue = (activePatentCount: number): number => {
  return activePatentCount * PATENT_VALUE_ESTIMATE;
};
