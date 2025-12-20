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
 * Uses edge function with service role to bypass RLS
 */
export async function syncUserCount() {
  try {
    // Call edge function to get total user count (bypasses RLS)
    const { data, error } = await supabase.functions.invoke("get-user-count");

    if (error) {
      console.error("[TrackIt] Error fetching user count:", error);
      return;
    }

    const userCount = data?.count ?? 0;
    
    if (window.KX?.setUserCount) {
      window.KX.setUserCount(userCount);
      console.log("[TrackIt] User count synced:", userCount);
    } else {
      console.log("[TrackIt] KX.setUserCount not available yet, count:", userCount);
    }
  } catch (err) {
    console.error("[TrackIt] Error syncing user count:", err);
  }
}

/**
 * Initialize TrackIt analytics - call on app startup
 */
export function initTrackIt() {
  // Sync user count on startup (with delay to ensure SDK is loaded)
  setTimeout(() => {
    syncUserCount();
  }, 2000);
}
