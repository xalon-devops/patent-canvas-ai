import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { LogIn, UserPlus, LayoutDashboard } from 'lucide-react';

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
    <header className={`sticky top-0 z-50 border-b ${transparent ? 'bg-transparent border-transparent' : 'bg-card/90 backdrop-blur-xl shadow-card'}`}>
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between py-3 sm:py-4">
          {/* Logo */}
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => navigate('/')}
          >
            <img 
              src="https://i.ibb.co/wrhwtf5P/Patent-Bot-AI-Logo-Transparent.png" 
              alt="PatentBot AI Logo" 
              className="h-10 sm:h-12 w-auto"
            />
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {loading ? (
              <div className="w-20 h-9 bg-muted/50 rounded animate-pulse" />
            ) : user ? (
              <Button 
                variant="gradient" 
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-sm"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/auth?tab=signin')}
                  className="text-sm"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Log In</span>
                </Button>
                <Button 
                  variant="gradient" 
                  size="sm"
                  onClick={() => navigate('/auth?tab=signup')}
                  className="text-sm"
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Up</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default PublicHeader;
