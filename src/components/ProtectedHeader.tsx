import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, MoreVertical, Settings, Key, LogOut, Shield, UserIcon } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';

interface ProtectedHeaderProps {
  /** Title to display in the header (optional, shows logo if omitted) */
  title?: string;
  /** Custom back button path (defaults to /dashboard) */
  backTo?: string;
  /** Label for back button (defaults to "Dashboard") */
  backLabel?: string;
  /** Show back arrow only (no label on mobile) */
  compactBack?: boolean;
  /** Children to render on the right side before the user menu */
  children?: React.ReactNode;
  /** Callback for password change dialog */
  onPasswordChange?: () => void;
}

export const ProtectedHeader: React.FC<ProtectedHeaderProps> = ({
  title,
  backTo = '/dashboard',
  backLabel = 'Dashboard',
  compactBack = false,
  children,
  onPasswordChange,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || null);
        // Check admin status
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .maybeSingle();
        setIsAdmin(!!data);
      }
    };
    getUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const isDashboard = location.pathname === '/dashboard';

  return (
    <header className="border-b border-border bg-card/95 backdrop-blur-xl sticky top-0 z-50" style={{ boxShadow: 'var(--shadow-xs)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between py-3 sm:py-4 gap-2">
          {/* Left side */}
          <div className="flex items-center gap-3 min-w-0">
            {isDashboard ? (
              <>
                <img 
                  src="https://i.ibb.co/nsLWZ3sr/Patent-Bot-Logo-1.png" 
                  alt="PatentBot AI Logo" 
                  className="h-9 sm:h-10 w-auto flex-shrink-0 cursor-pointer"
                  onClick={() => navigate('/')}
                />
                {userEmail && (
                  <p className="text-xs text-muted-foreground hidden sm:block truncate">
                    {userEmail}
                  </p>
                )}
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(backTo)}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {!compactBack && <span className="hidden sm:inline">{backLabel}</span>}
                </Button>
                {title && (
                  <>
                    <div className="w-px h-5 bg-border" />
                    <h1 className="text-base sm:text-lg font-semibold text-foreground truncate tracking-tight">
                      {title}
                    </h1>
                  </>
                )}
              </>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isAdmin && location.pathname !== '/admin' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin')}
                className="text-muted-foreground hover:text-foreground hidden sm:flex gap-1.5 text-xs"
              >
                <Shield className="h-3.5 w-3.5" />
                Admin
              </Button>
            )}

            {children}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground p-1.5">
                  <UserAvatar size="sm" />
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border border-border min-w-[180px]" style={{ boxShadow: 'var(--shadow-elegant)' }}>
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <UserIcon className="h-4 w-4 mr-2" />Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="h-4 w-4 mr-2" />Settings
                </DropdownMenuItem>
                {onPasswordChange && (
                  <DropdownMenuItem onClick={onPasswordChange}>
                    <Key className="h-4 w-4 mr-2" />Change Password
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

export default ProtectedHeader;
