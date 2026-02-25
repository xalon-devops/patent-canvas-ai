import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface PublicHeaderProps {
  transparent?: boolean;
}

export const PublicHeader: React.FC<PublicHeaderProps> = ({ transparent = false }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
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

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  const handleNavClick = (href: string) => {
    if (href.startsWith('#')) {
      const el = document.querySelector(href);
      el?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(href);
    }
  };

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4"
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={`
          flex items-center justify-between w-full max-w-5xl
          rounded-2xl border px-4 sm:px-6 py-3
          transition-all duration-500 ease-out
          ${scrolled
            ? 'bg-card/90 backdrop-blur-2xl border-border/50 shadow-elegant'
            : 'bg-card/60 backdrop-blur-xl border-border/20 shadow-card'
          }
        `}
      >
        {/* Logo */}
        <div
          className="cursor-pointer flex-shrink-0"
          onClick={() => navigate('/')}
        >
          <img
            src="https://i.ibb.co/nsLWZ3sr/Patent-Bot-Logo-1.png"
            alt="PatentBot AI"
            className="h-8 sm:h-9 w-auto"
          />
        </div>

        {/* Center nav links - hidden on mobile */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => handleNavClick(link.href)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted/50 transition-all duration-200"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Auth buttons */}
        <nav className="flex items-center gap-2">
          {loading ? (
            <div className="w-20 h-9 bg-muted/30 rounded-xl animate-pulse" />
          ) : user ? (
            <Button
              size="sm"
              className="rounded-xl bg-foreground text-background hover:bg-foreground/90 font-medium"
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
                className="text-muted-foreground hover:text-foreground rounded-xl"
              >
                Login
              </Button>
              <Button
                size="sm"
                className="rounded-xl bg-foreground text-background hover:bg-foreground/90 font-medium"
                onClick={() => navigate('/auth?tab=signup')}
              >
                Sign Up
              </Button>
            </>
          )}
        </nav>
      </div>
    </motion.header>
  );
};

export default PublicHeader;
