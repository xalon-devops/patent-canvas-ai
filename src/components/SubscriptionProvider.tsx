import React, { createContext, useContext, useState, useEffect } from 'react';
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

  const checkSubscription = async () => {
    if (!user) return;
    
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
  };

  useEffect(() => {
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await checkSubscription();
        } else {
          setSubscription(null);
        }
        
        setLoading(false);
      }
    );

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkSubscription();
      } else {
        setLoading(false);
      }
    });

    return () => authSubscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      checkSubscription();
    }
  }, [user]);

  const value = {
    user,
    subscription,
    loading,
    checkSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};