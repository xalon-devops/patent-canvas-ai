import { useUserProfile } from '@/contexts/UserProfileContext';

interface AdminStatus {
  isAdmin: boolean;
  isFreeGrant: boolean;
  loading: boolean;
  canBypassPaywall: boolean;
}

/**
 * Admin / free-grant status for the signed-in user.
 * Reads the shared access state from UserProfileContext (fetched once per login)
 * instead of querying user_roles + subscriptions on every mount.
 */
export const useAdminStatus = (userId: string | undefined): AdminStatus => {
  const { user, access, loading: profileLoading } = useUserProfile();

  if (!userId) {
    // Caller hasn't resolved its user yet; report loading while auth is still resolving.
    return { isAdmin: false, isFreeGrant: false, loading: profileLoading, canBypassPaywall: false };
  }

  if (user?.id !== userId) {
    return { isAdmin: false, isFreeGrant: false, loading: profileLoading, canBypassPaywall: false };
  }

  return {
    isAdmin: access.isAdmin,
    isFreeGrant: access.isFreeGrant,
    loading: !access.loaded,
    canBypassPaywall: access.isAdmin || access.isFreeGrant,
  };
};

export default useAdminStatus;
