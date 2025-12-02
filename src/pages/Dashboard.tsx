import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Plus, FileText, Clock, CheckCircle, Scale, LogOut, Sparkles, Search, Shield, Settings, Key, MoreVertical, ArrowRight, AlertTriangle, Lightbulb, DollarSign } from 'lucide-react';
import { usePatentData } from '@/hooks/usePatentData';
import { WelcomeOnboarding } from '@/components/WelcomeOnboarding';

// Admin button - only shows for users with admin role
function AdminButton({ userId }: { userId: string | undefined }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    
    const checkAdmin = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      setIsAdmin(!!data);
    };
    
    checkAdmin();
  }, [userId]);

  if (!isAdmin) return null;

  return (
    <Button 
      variant="ghost" 
      size="sm"
      onClick={() => navigate('/admin')}
      className="text-muted-foreground hover:text-foreground hidden sm:flex"
    >
      <Shield className="h-4 w-4" />
      Admin
    </Button>
  );
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate('/auth');
        }
      }
    );

    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setLoading(false);
      toast({
        title: "Loading timeout",
        description: "Taking longer than expected. Please refresh if needed.",
        variant: "default",
      });
    }, 10000); // 10 second timeout

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        clearTimeout(timeout);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (error) {
          console.error('Session error:', error);
          toast({
            title: "Session Error",
            description: error.message,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        if (!session?.user) {
          navigate('/auth');
        } else {
          // Check if this is a new user (show welcome if not dismissed)
          const welcomeDismissed = localStorage.getItem('patentbot_welcome_dismissed');
          if (!welcomeDismissed) {
            setShowWelcome(true);
          }
          setLoading(false);
        }
      })
      .catch((error) => {
        clearTimeout(timeout);
        console.error('Auth error:', error);
        setLoading(false);
        toast({
          title: "Authentication Error",
          description: "Please try signing in again.",
          variant: "destructive",
        });
        navigate('/auth');
      });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate, toast]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "New password and confirmation don't match",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    setPasswordLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      toast({
        title: "Password updated",
        description: "Your password has been successfully changed",
        variant: "default",
      });

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setIsPasswordDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Password update failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const createNewSession = () => {
    navigate('/new-application');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your patents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-card/90 backdrop-blur-xl sticky top-0 z-50 shadow-card">
        <div className="safe-area px-4 sm:px-6">
          <div className="content-width">
            <div className="flex items-center justify-between py-3 sm:py-4 gap-2">
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <img 
                  src="https://i.ibb.co/wrhwtf5P/Patent-Bot-AI-Logo-Transparent.png" 
                  alt="PatentBot AI Logo" 
                  className="h-10 sm:h-12 w-auto flex-shrink-0"
                />
                <p className="text-xs sm:text-sm text-muted-foreground hidden xs:block truncate">
                  {user?.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <AdminButton userId={user?.id} />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                      <Settings className="h-4 w-4" />
                      <MoreVertical className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass border-white/10">
                    <DropdownMenuItem onClick={() => setIsPasswordDialogOpen(true)}>
                      <Key className="h-4 w-4 mr-2" />
                      Change Password
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSignOut}>
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

      {/* Password Change Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md glass">
          <DialogHeader className="text-center">
            <DialogTitle className="flex items-center justify-center gap-3 text-xl">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Key className="h-5 w-5 text-primary" />
              </div>
              Change Password
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter your new password below. You don't need to enter your current password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                required
                minLength={6}
                className="glass border-white/10 focus:border-primary/50 transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm new password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                required
                minLength={6}
                className="glass border-white/10 focus:border-primary/50 transition-all duration-200"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsPasswordDialogOpen(false)}
                className="flex-1 glass border-white/10"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="gradient"
                disabled={passwordLoading}
                className="flex-1 shadow-glow"
              >
                {passwordLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4" />
                    Update Password
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <main className="safe-area px-4 sm:px-6 py-6 sm:py-8">
        <div className="content-width">
          {/* Welcome Onboarding for New Users */}
          {showWelcome && (
            <WelcomeOnboarding 
              userName={user?.email}
              onDismiss={() => {
                setShowWelcome(false);
                localStorage.setItem('patentbot_welcome_dismissed', 'true');
              }}
            />
          )}

          {/* Pricing Cards */}
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 mb-6 sm:mb-8">
            <Card className="p-4 sm:p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:shadow-glow/30 transition-all duration-500">
              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="p-2 sm:p-3 bg-primary/10 rounded-lg flex-shrink-0">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-semibold">File Patent Application</h3>
                  <p className="text-sm text-muted-foreground hidden sm:block">Complete AI-guided patent drafting</p>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span>Complete patent sections generated</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span>Professional USPTO-ready format</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span>Export to DOCX/PDF</span>
                </div>
                <div className="text-2xl font-bold text-primary mb-2">$1,000</div>
                <div className="text-sm text-muted-foreground mb-4">One-time payment per application</div>
              </div>
              <div className="space-y-3">
                <Button 
                  onClick={createNewSession} 
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  Start New Patent ($1,000)
                </Button>
                <Button 
                  onClick={() => navigate('/drafts')} 
                  variant="outline"
                  className="w-full"
                >
                  Resume Draft Applications
                </Button>
              </div>
            </Card>

            <Card className="p-4 sm:p-6 bg-gradient-to-br from-secondary/5 to-secondary/10 border-secondary/20 hover:shadow-glow/30 transition-all duration-500">
              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="p-2 sm:p-3 bg-secondary/10 rounded-lg flex-shrink-0">
                  <Search className="h-5 w-5 sm:h-6 sm:w-6 text-secondary" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-semibold">Check & See</h3>
                  <p className="text-sm text-muted-foreground hidden sm:block">Search for existing patents before you file</p>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-secondary" />
                  <span>Search multiple patent databases</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-secondary" />
                  <span>AI-powered similarity analysis</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-secondary" />
                  <span>Unlimited searches with subscription</span>
                </div>
                <div className="text-2xl font-bold text-secondary mb-2">$9.99</div>
                <div className="text-sm text-muted-foreground mb-4">Monthly subscription</div>
              </div>
              <Button 
                onClick={() => navigate('/check')} 
                className="w-full bg-secondary hover:bg-secondary/90"
              >
                <Search className="h-6 w-6" />
                Start Searching ($9.99/month)
              </Button>
            </Card>
          </div>

          {/* Portfolio Overview */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
              Your Patent Portfolio
            </h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto text-lg">
              AI-powered patent management with real-time competitive intelligence and infringement monitoring.
            </p>
          </div>

          {/* Dynamic Portfolio Stats */}
          <PortfolioStatsSection userId={user?.id} />

          {/* Enhanced Navigation Menu */}
          <div className="grid gap-4 sm:gap-6 md:gap-8 sm:grid-cols-2 md:grid-cols-3 mb-8 sm:mb-12">
            <Card 
              className="glass group relative overflow-hidden border-accent/30 hover:border-accent/50 hover:shadow-glow transition-all duration-500 cursor-pointer transform hover:scale-[1.02]"
              onClick={() => navigate('/ideas')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-accent/10 opacity-60 group-hover:opacity-80 transition-opacity" />
              <CardContent className="relative p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-accent/10 rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Sparkles className="h-8 w-8 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Ideas Lab</h3>
                    <p className="text-muted-foreground">Capture & monitor innovations</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Track your inventions with daily competitive landscape monitoring and prior art alerts.
                </p>
                <div className="flex items-center gap-2 text-accent font-medium group-hover:gap-3 transition-all">
                  <span>Explore Ideas</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="glass group relative overflow-hidden border-blue-500/30 hover:border-blue-500/50 hover:shadow-glow transition-all duration-500 cursor-pointer transform hover:scale-[1.02]"
              onClick={() => navigate('/pending')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-500/10 opacity-60 group-hover:opacity-80 transition-opacity" />
              <CardContent className="relative p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-blue-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Pending Patents</h3>
                    <p className="text-muted-foreground">Track application progress</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Real-time updates on filing status, examiner actions, and competitive intelligence.
                </p>
                <div className="flex items-center gap-2 text-blue-500 font-medium group-hover:gap-3 transition-all">
                  <span>View Applications</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="glass group relative overflow-hidden border-green-500/30 hover:border-green-500/50 hover:shadow-glow transition-all duration-500 cursor-pointer transform hover:scale-[1.02]"
              onClick={() => navigate('/active')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-green-500/10 opacity-60 group-hover:opacity-80 transition-opacity" />
              <CardContent className="relative p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-green-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Shield className="h-8 w-8 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Active Patents</h3>
                    <p className="text-muted-foreground">Protect your IP assets</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Automated infringement detection, maintenance tracking, and portfolio valuation.
                </p>
                <div className="flex items-center gap-2 text-green-500 font-medium group-hover:gap-3 transition-all">
                  <span>Manage Portfolio</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Call-to-Action Section */}
          <div className="text-center bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 rounded-3xl p-12 border border-primary/10">
            <div className="max-w-2xl mx-auto">
              <h3 className="text-3xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
                Ready to Protect Your Innovation?
              </h3>
              <p className="text-lg text-muted-foreground mb-8">
                Experience the most advanced AI-powered patent drafting system. From idea to USPTO filing in minutes.
              </p>
              <Button 
                onClick={createNewSession} 
                size="lg" 
                className="px-12 py-6 text-xl font-bold bg-gradient-primary hover:scale-105 transform transition-all duration-300 shadow-glow hover:shadow-2xl group"
              >
                <Plus className="h-6 w-6 mr-3 group-hover:rotate-90 transition-transform" />
                Start Patent Application
                <ArrowRight className="h-6 w-6 ml-3 group-hover:translate-x-2 transition-transform" />
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                * Professional USPTO-ready documents • 24/7 AI assistance • Competitive intelligence
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// Portfolio Stats Component using centralized data hook
function PortfolioStatsSection({ userId }: { userId: string | undefined }) {
  const { stats, loading } = usePatentData(userId);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="glass animate-pulse">
            <CardContent className="p-4 sm:p-6">
              <div className="h-12 bg-muted/50 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <Card className="glass hover:shadow-glow/20 transition-all">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-primary/10 rounded-xl">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold">{stats.totalApplications}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Applications</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass hover:shadow-glow/20 transition-all">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-green-500/10 rounded-xl">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold">{stats.activePatents}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Active Patents</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass hover:shadow-glow/20 transition-all">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-accent/10 rounded-xl">
              <Lightbulb className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold">{stats.totalIdeas}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Ideas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass hover:shadow-glow/20 transition-all">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-orange-500/10 rounded-xl">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold">{stats.unreadAlerts}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Alerts</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;