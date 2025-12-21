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
    <header className={`sticky top-0 z-50 ${transparent ? 'bg-transparent' : 'bg-background/80 backdrop-blur-xl border-b border-border/50'}`}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo - Text based, institutional */}
          <div 
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={() => navigate('/')}
          >
            <img 
              src="https://i.ibb.co/wrhwtf5P/Patent-Bot-AI-Logo-Transparent.png" 
              alt="PatentBot AI" 
              className="h-8 w-auto opacity-90 group-hover:opacity-100 transition-opacity"
            />
            <span className="text-foreground font-medium text-lg tracking-tight hidden sm:block">
              PatentBot AI
            </span>
          </div>

          {/* Navigation - Minimal */}
          <nav className="flex items-center gap-6">
            {loading ? (
              <div className="w-20 h-9 bg-muted/30 rounded-lg animate-pulse" />
            ) : user ? (
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-foreground/70 hover:text-foreground"
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
                  className="text-foreground/70 hover:text-foreground"
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