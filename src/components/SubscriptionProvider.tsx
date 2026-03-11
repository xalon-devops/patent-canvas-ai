import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface SubscriptionData {
  subscribed: boolean;
  plan: string;
  currentPeriodEnd?: string;
}

interface SubscriptionContextType {
  user: User | null;
  subscription: SubscriptionData | null;
  loading: boolean;
  checkSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSubscription = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) {
        console.error('Error checking subscription:', error);
        setSubscription({ subscribed: false, plan: 'free' });
        return;
      }
      setSubscription(data);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscription({ subscribed: false, plan: 'free' });
    }
  }, []);

  useEffect(() => {
    // IMPORTANT: No async calls inside onAuthStateChange
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setSubscription(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setLoading(false);
      }
    });

    return () => authSubscription.unsubscribe();
  }, []);

  // Fetch subscription when user changes (separate effect, no async in callback)
  useEffect(() => {
    if (user) {
      checkSubscription().finally(() => setLoading(false));
    }
  }, [user?.id, checkSubscription]);

  return (
    <SubscriptionContext.Provider value={{ user, subscription, loading, checkSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
