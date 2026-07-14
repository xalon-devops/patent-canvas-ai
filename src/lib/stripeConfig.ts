// Stripe Configuration
// Prices are resolved server-side by product name + unit_amount in the
// create-checkout, create-payment, and create-trademark-checkout edge functions.
// Do not add hardcoded Stripe price IDs here — they drift silently when prices change.

export const STRIPE_AMOUNTS = {
  PATENT_APPLICATION: 100000, // $1,000.00 in cents
  CHECK_AND_SEE: 9999,        // $99.99/mo in cents
  TRADEMARK_SUITE: 4999,      // $49.99/mo in cents
};

// Publishable key is safe to ship in client code
export const STRIPE_PUBLISHABLE_KEY = 'pk_live_51RdXE2KFoovQj4C21CsJdSVAwgULoWVdDMVUuoQZjd2NBxehG1zipBXiAY6Te23TFXzRDMHMh7V9D6EF9NH8I05w00R8CbWKYS';
