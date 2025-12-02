// Stripe Configuration - LIVE PRICE IDs
// These are the actual Stripe price IDs for PatentBot AI

export const STRIPE_PRICES = {
  // Patent Application - $1,000 one-time payment
  PATENT_APPLICATION: 'price_1RdXGjKFoovQj4C2M0KxKh8B',
  
  // Check & See Subscription - $9.99/month
  CHECK_AND_SEE: 'price_1RdXHaKFoovQj4C2Vx8MmN3P'
};

export const STRIPE_AMOUNTS = {
  PATENT_APPLICATION: 100000, // $1,000 in cents
  CHECK_AND_SEE: 999 // $9.99 in cents
};

// Stripe publishable key (live mode)
export const STRIPE_PUBLISHABLE_KEY = 'pk_live_51RdXE2KFoovQj4C21CsJdSVAwgULoWVdDMVUuoQZjd2NBxehG1zipBXiAY6Te23TFXzRDMHMh7V9D6EF9NH8I05w00R8CbWKYS';
