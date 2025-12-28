import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { ArrowRight } from 'lucide-react';


interface PublicHeaderProps {
  transparent?: boolean;
}

export const PublicHeader: React.FC<PublicHeaderProps> = ({ transparent = false }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className={`sticky top-0 z-50 ${transparent ? 'bg-transparent' : 'glass-strong border-b border-border/30'}`}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-18 py-4">
          {/* Logo */}
          <div 
            className="cursor-pointer" 
            onClick={() => navigate('/')}
          >
            <img 
              src="https://i.ibb.co/nsLWZ3sr/Patent-Bot-Logo-1.png" 
              alt="PatentBot AI" 
              className="h-10 w-auto opacity-90 hover:opacity-100 transition-opacity"
            />
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-2 sm:gap-4">
            {loading ? (
              <div className="w-20 h-9 bg-muted/30 rounded-xl animate-pulse" />
            ) : user ? (
              <Button 
                variant="default"
                size="sm"
                onClick={() => navigate('/dashboard')}
              >
                Dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/auth?tab=signin')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Sign in
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => navigate('/auth?tab=signup')}
                >
                  Get Started
                </Button>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default PublicHeader;