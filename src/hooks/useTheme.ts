import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'patentbot-theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    // Default to dark
    return 'dark';
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from user preferences in Supabase (if logged in)
  useEffect(() => {
    const loadThemeFromProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('bio')
            .eq('user_id', user.id)
            .single();
          
          // We'll store theme in the bio field's JSON or a dedicated field
          // For now, use localStorage as primary with sync to profile
          if (profile?.bio) {
            try {
              const prefs = JSON.parse(profile.bio);
              if (prefs.theme === 'light' || prefs.theme === 'dark') {
                setTheme(prefs.theme);
                localStorage.setItem(THEME_STORAGE_KEY, prefs.theme);
              }
            } catch {
              // bio is not JSON, that's fine
            }
          }
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadThemeFromProfile();
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    // Persist to user profile if logged in
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('bio')
          .eq('user_id', user.id)
          .single();
        
        let prefs: Record<string, unknown> = {};
        if (profile?.bio) {
          try {
            prefs = JSON.parse(profile.bio);
          } catch {
            // Not JSON, start fresh
          }
        }
        
        prefs.theme = newTheme;
        
        await supabase
          .from('profiles')
          .update({ bio: JSON.stringify(prefs) })
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  return { theme, setTheme, toggleTheme, isLoading };
}
