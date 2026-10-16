// Extracts the real message from a Supabase Edge Function error response.
export async function getEdgeErrorMessage(error: any, fallback = 'Something went wrong. Please try again.'): Promise<{ message: string; status?: number; requiresSubscription?: boolean }> {
  const ctx = error?.context;
  let status: number | undefined = ctx?.status;
  try {
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.clone().json();
      return { message: body?.error || fallback, status, requiresSubscription: !!body?.requires_subscription || status === 402 };
    }
  } catch { /* ignore */ }
  const msg = error?.message && !String(error.message).includes('non-2xx') ? error.message : fallback;
  return { message: msg, status, requiresSubscription: status === 402 };
}
