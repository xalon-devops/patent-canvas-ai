import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  full_name: string | null;
  company: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAccess {
  isAdmin: boolean;
  isFreeGrant: boolean;
  /** Active/trialing subscription on any non-free plan (includes free_grant) */
  isPaid: boolean;
  plan: string | null;
  status: string | null;
  /** True once roles + subscription have been fetched for the current user */
  loaded: boolean;
}

const EMPTY_ACCESS: UserAccess = { isAdmin: false, isFreeGrant: false, isPaid: false, plan: null, status: null, loaded: false };

interface UserProfileContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  access: UserAccess;
  refreshAccess: () => Promise<void>;
  error: string | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
  uploadAvatar: (file: File) => Promise<string | null>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [access, setAccess] = useState<UserAccess>(EMPTY_ACCESS);

  // Roles + subscription are fetched once per signed-in user and shared app-wide
  // (headers, route guards and paywalls all read from here instead of re-querying).
  const fetchAccess = useCallback(async (userId: string) => {
    const [roleRes, subRes] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle(),
      supabase.from('subscriptions').select('plan, status').eq('user_id', userId).maybeSingle(),
    ]);
    const plan = subRes.data?.plan ?? null;
    const status = subRes.data?.status ?? null;
    const active = status === 'active' || status === 'trialing';
    setAccess({
      isAdmin: !!roleRes.data,
      isFreeGrant: plan === 'free_grant' && status === 'active',
      isPaid: active && !!plan && plan !== 'free',
      plan,
      status,
      loaded: true,
    });
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      // First try to get existing profile
      let { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // If no profile exists, create one
      if (!data) {
        const { data: userData } = await supabase.auth.getUser();
        const email = userData.user?.email || '';
        const displayName = email.split('@')[0];

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            display_name: displayName,
          })
          .select()
          .single();

        if (insertError) {
          // Profile might have been created by trigger, try fetching again
          const { data: retryData } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
          data = retryData;
        } else {
          data = newProfile;
        }
      }

      setProfile(data as UserProfile);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError(err.message);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  const refreshAccess = useCallback(async () => {
    if (user?.id) {
      await fetchAccess(user.id);
    }
  }, [user?.id, fetchAccess]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Refresh profile to get updated data
      await refreshProfile();
      return true;
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message);
      return false;
    }
  }, [user?.id, refreshProfile]);

  const uploadAvatar = useCallback(async (file: File): Promise<string | null> => {
    if (!user?.id) return null;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Avatar must be a JPEG, PNG, WebP or GIF image.');
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Avatar must be 5MB or smaller.');
      return null;
    }

    try {
      // Create a unique file path: user_id/timestamp.ext
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload new avatar first so a failed upload never leaves the user without one
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      // Then delete the old avatar (only files inside this user's folder)
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/avatars/')[1]?.split('?')[0];
        if (oldPath && oldPath.startsWith(`${user.id}/`) && oldPath !== fileName) {
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      await updateProfile({ avatar_url: publicUrl });

      return publicUrl;
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      setError(err.message);
      return null;
    }
  }, [user?.id, profile?.avatar_url, updateProfile]);

  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      // IMPORTANT: do not call Supabase or async logic inside this callback
      setUser(session?.user ?? null);
      setAuthChecked(true);
    });

    // Initial session check (can be async)
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
        setAuthChecked(true);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('UserProfileProvider getSession error:', err);
        setUser(null);
        setAuthChecked(true);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Wait until the initial auth check has completed before deciding.
      if (!authChecked) {
        setLoading(true);
        return;
      }

      if (!user?.id) {
        setProfile(null);
        setAccess(EMPTY_ACCESS);
        setLoading(false);
        return;
      }

      setLoading(true);
      setAccess(EMPTY_ACCESS);
      await Promise.all([
        fetchProfile(user.id),
        fetchAccess(user.id).catch((err) => {
          console.error('Error fetching access:', err);
          if (!cancelled) setAccess({ ...EMPTY_ACCESS, loaded: true });
        }),
      ]);
      if (!cancelled) setLoading(false);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [authChecked, user?.id, fetchProfile, fetchAccess]);

  return (
    <UserProfileContext.Provider
      value={{
        user,
        profile,
        loading,
        access,
        refreshAccess,
        error,
        refreshProfile,
        updateProfile,
        uploadAvatar,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};
