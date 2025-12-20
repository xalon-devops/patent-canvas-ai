import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    KX?: {
      purchase: (data: {
        order_id: string;
        amount_cents: number;
        currency: string;
        items: Array<{ name: string; quantity: number }>;
      }) => void;
      setUserCount: (count: number) => void;
    };
  }
}

/**
 * Track a purchase event with TrackIt
 */
export function trackPurchase(data: {
  order_id: string;
  amount_cents: number;
  currency: string;
  items: Array<{ name: string; quantity: number }>;
}) {
  if (window.KX?.purchase) {
    window.KX.purchase(data);
    console.log("[TrackIt] Purchase tracked:", data);
  }
}

/**
 * Send current user count to TrackIt
 * This counts total users from the users table (which mirrors auth.users)
 */
export async function syncUserCount() {
  try {
    // Count total users from the public.users table
    const { count, error } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("[TrackIt] Error fetching user count:", error);
      return;
    }

    const userCount = count ?? 0;
    
    if (window.KX?.setUserCount) {
      window.KX.setUserCount(userCount);
      console.log("[TrackIt] User count synced:", userCount);
    }
  } catch (err) {
    console.error("[TrackIt] Error syncing user count:", err);
  }
}

/**
 * Initialize TrackIt analytics - call on app startup
 */
export function initTrackIt() {
  // Sync user count on startup (with small delay to ensure SDK is loaded)
  setTimeout(() => {
    syncUserCount();
  }, 1000);
}
