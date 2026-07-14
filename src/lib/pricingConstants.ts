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
export const CHECK_AND_SEE_PRICE_CENTS = 9999; // $99.99

/** Check & See monthly subscription (display value) */
export const CHECK_AND_SEE_PRICE = 99.99;

// ===== STRIPE PRICE IDs =====
// NOTE: Stripe prices are resolved server-side by product name + unit_amount in the
// create-checkout / create-payment / create-trademark-checkout edge functions.
// These constants are kept as empty strings for backward compatibility only —
// do NOT rely on them client-side. Any value passed to the edge functions is ignored.
export const STRIPE_PATENT_APPLICATION_PRICE_ID = '';
export const STRIPE_CHECK_AND_SEE_PRICE_ID = '';


// ===== TRADEMARK PRICING =====

/** Trademark Search monthly subscription (in cents for Stripe) */
export const TRADEMARK_SEARCH_PRICE_CENTS = 4999; // $49.99

/** Trademark Search monthly subscription (display value) */
export const TRADEMARK_SEARCH_PRICE = 49.99;

/** Trademark Filing one-time fee (in cents for Stripe) */
export const TRADEMARK_FILING_PRICE_CENTS = 50000; // $500.00

/** Trademark Filing one-time fee (display value) */
export const TRADEMARK_FILING_PRICE = 500;

// ===== FORMATTED DISPLAY STRINGS =====

/** Formatted patent application price for display */
export const PATENT_APPLICATION_PRICE_DISPLAY = '$1,000';

/** Formatted Check & See price for display */
export const CHECK_AND_SEE_PRICE_DISPLAY = '$99.99';

/** Formatted Check & See price with period */
export const CHECK_AND_SEE_PRICE_DISPLAY_MONTHLY = '$99.99/month';

/** Formatted Check & See price with short period */
export const CHECK_AND_SEE_PRICE_DISPLAY_MO = '$99.99/mo';

/** Formatted trademark search price for display */
export const TRADEMARK_SEARCH_PRICE_DISPLAY = '$49.99';

/** Formatted trademark search price with period */
export const TRADEMARK_SEARCH_PRICE_DISPLAY_MO = '$49.99/mo';

/** Formatted trademark filing price for display */
export const TRADEMARK_FILING_PRICE_DISPLAY = '$500';

// ===== PATENT VALUATION =====

/** Estimated value per active patent (for portfolio valuation) */
export const PATENT_VALUE_ESTIMATE = 125000; // $125,000

/** Patent term in years from grant date */
export const PATENT_TERM_YEARS = 20;

// ===== FREE TIER LIMITS =====

/** Number of free prior art searches allowed */
export const FREE_SEARCHES_LIMIT = 3;

// ===== QUERY LIMITS =====

/** Maximum rows to fetch from Supabase in a single query (high for popular app scale) */
export const SUPABASE_QUERY_LIMIT = 50000;

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
