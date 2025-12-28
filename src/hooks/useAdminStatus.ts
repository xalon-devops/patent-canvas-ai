import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminStatus {
  isAdmin: boolean;
  isFreeGrant: boolean;
  loading: boolean;
  canBypassPaywall: boolean;
}

export const useAdminStatus = (userId: string | undefined): AdminStatus => {
  const [status, setStatus] = useState<AdminStatus>({
    isAdmin: false,
    isFreeGrant: false,
    loading: true,
    canBypassPaywall: false
  });

  const checkStatus = useCallback(async () => {
    if (!userId) {
      setStatus({
        isAdmin: false,
        isFreeGrant: false,
        loading: false,
        canBypassPaywall: false
      });
      return;
    }

    try {
      // Check admin role
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      // Check for free grant subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', userId)
        .maybeSingle();

      const isAdmin = !!adminRole;
      const isFreeGrant = subscription?.plan === 'free_grant' && subscription?.status === 'active';

      setStatus({
        isAdmin,
        isFreeGrant,
        loading: false,
        canBypassPaywall: isAdmin || isFreeGrant
      });
    } catch (error) {
      console.error('Error checking admin status:', error);
      setStatus({
        isAdmin: false,
        isFreeGrant: false,
        loading: false,
        canBypassPaywall: false
      });
    }
  }, [userId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return status;
};

export default useAdminStatus;
