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
    <header className="border-b bg-card/90 backdrop-blur-xl sticky top-0 z-50 shadow-card">
      <div className="safe-area px-4 sm:px-6">
        <div className="content-width">
          <div className="flex items-center justify-between py-3 sm:py-4 gap-2">
            {/* Left side: Back button or Logo */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              {isDashboard ? (
                <>
                  <img 
                    src="https://i.ibb.co/nsLWZ3sr/Patent-Bot-Logo-1.png" 
                    alt="PatentBot AI Logo" 
                    className="h-10 sm:h-12 w-auto flex-shrink-0 cursor-pointer"
                    onClick={() => navigate('/')}
                  />
                  {userEmail && (
                    <p className="text-xs sm:text-sm text-muted-foreground hidden xs:block truncate">
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
                    className="gap-2 hover:scale-105 transition-transform"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {!compactBack && <span className="hidden sm:inline">{backLabel}</span>}
                  </Button>
                  {title && (
                    <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">
                      {title}
                    </h1>
                  )}
                </>
              )}
            </div>

            {/* Right side: custom children + user menu */}
            <div className="flex items-center gap-2">
              {/* Admin link (if admin) */}
              {isAdmin && location.pathname !== '/admin' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="text-muted-foreground hover:text-foreground hidden sm:flex"
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </Button>
              )}

              {children}

              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground hover:text-foreground p-1">
                    <UserAvatar size="sm" />
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass border-white/10 min-w-[180px]">
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <UserIcon className="h-4 w-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  {onPasswordChange && (
                    <DropdownMenuItem onClick={onPasswordChange}>
                      <Key className="h-4 w-4 mr-2" />
                      Change Password
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default ProtectedHeader;
