// Stripe Configuration
// Replace these with your actual Stripe Price IDs

export const STRIPE_PRICES = {
  // Patent Application - $1,000 one-time
  PATENT_APPLICATION: process.env.NODE_ENV === 'production' 
    ? 'price_PATENT_APP_PROD' // Replace with your production price ID
    : 'price_PATENT_APP_TEST', // Replace with your test price ID
  
  // Check & See Subscription - $9.99/month
  CHECK_AND_SEE: process.env.NODE_ENV === 'production'
    ? 'price_CHECK_SEE_PROD' // Replace with your production price ID
    : 'price_CHECK_SEE_TEST'  // Replace with your test price ID
};

export const STRIPE_AMOUNTS = {
  PATENT_APPLICATION: 100000, // $1,000 in cents
  CHECK_AND_SEE: 999 // $9.99 in cents
};
