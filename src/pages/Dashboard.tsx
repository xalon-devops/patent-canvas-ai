import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, FileText, Clock, CheckCircle, Scale, LogOut, Sparkles, Search, Shield, Settings, Key, MoreVertical, ArrowRight, AlertTriangle, Lightbulb, DollarSign, UserIcon, Tag, PenTool, Radar } from 'lucide-react';

import { usePortfolioCounts } from '@/hooks/usePatentData';
import PriorArtMonitoringDashboard from '@/components/PriorArtMonitoringDashboard';
import TrademarkMonitoringDashboard from '@/components/TrademarkMonitoringDashboard';
import { WelcomeWizard } from '@/components/WelcomeWizard';
import { PageSEO } from '@/components/SEO';
import { getCurrentISOString } from '@/lib/dateUtils';
import { UserAvatar } from '@/components/UserAvatar';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { 
  PATENT_APPLICATION_PRICE_DISPLAY, 
  CHECK_AND_SEE_PRICE_DISPLAY,
  TRADEMARK_SEARCH_PRICE_DISPLAY,
  TRADEMARK_FILING_PRICE_DISPLAY,
} from '@/lib/pricingConstants';

const Dashboard = () => {
  // Auth is enforced by ProtectedRoute; the signed-in user comes from the shared context
  const { user } = useUserProfile();
  const accessStatus = useAdminStatus(user?.id);
  const fullAccess = accessStatus.canBypassPaywall;
  const [quickUrl, setQuickUrl] = useState('');
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

  const userId = user?.id;
  const userEmail = user?.email ?? null;

  // Onboarding state persists in users.onboarding_completed_at (localStorage only as a fallback)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const localDismissed = () => {
      try { return !!localStorage.getItem(`patentbot_welcome_dismissed:${userId}`); } catch { return false; }
    };

    (async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('onboarding_completed_at')
          .eq('id', userId)
          .maybeSingle();
        if (cancelled) return;

        if (error) { setShowWelcome(!localDismissed()); return; }

        if (!data) {
          // Row is normally created by the auth trigger; create it if it is missing
          await supabase.from('users').upsert({ id: userId, email: userEmail }, { onConflict: 'id' });
          if (!cancelled) setShowWelcome(!localDismissed());
          return;
        }

        setShowWelcome(!data.onboarding_completed_at && !localDismissed());
      } catch {
        if (!cancelled) setShowWelcome(!localDismissed());
      }
    })();

    return () => { cancelled = true; };
  }, [userId, userEmail]);

  const completeOnboarding = async () => {
    setShowWelcome(false);
    if (!userId) return;
    try { localStorage.setItem(`patentbot_welcome_dismissed:${userId}`, 'true'); } catch { /* storage unavailable */ }
    const { error } = await supabase
      .from('users')
      .update({ onboarding_completed_at: getCurrentISOString() })
      .eq('id', userId);
    if (error) console.error('Could not save onboarding state:', error);
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
    } catch { navigate('/auth'); }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Password mismatch", description: "New password and confirmation don't match", variant: "destructive" });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters long", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (error) throw error;
      toast({ title: "Password updated", description: "Your password has been successfully changed" });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setIsPasswordDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Password update failed", description: error.message, variant: "destructive" });
    } finally { setPasswordLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageSEO.Dashboard />
      
      {/* Header */}
      <header className="border-b border-border bg-card/95 backdrop-blur-xl sticky top-0 z-50" style={{ boxShadow: 'var(--shadow-xs)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-3 sm:py-4 gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <img 
                src="https://i.ibb.co/nsLWZ3sr/Patent-Bot-Logo-1.png" 
                alt="PatentBot AI Logo" 
                className="h-9 sm:h-10 w-auto flex-shrink-0 cursor-pointer"
                onClick={() => navigate('/')}
              />
              <p className="text-xs text-muted-foreground hidden sm:block truncate">
                {user?.email}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {accessStatus.isAdmin && (
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
                  <DropdownMenuItem onClick={() => setIsPasswordDialogOpen(true)}>
                    <Key className="h-4 w-4 mr-2" />Change Password
                  </DropdownMenuItem>
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

      {/* Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border" style={{ boxShadow: 'var(--shadow-elegant)' }}>
          <DialogHeader className="text-center">
            <DialogTitle className="flex items-center justify-center gap-3 text-lg">
              <div className="p-2 bg-primary/8 rounded-xl">
                <Key className="h-5 w-5 text-primary" />
              </div>
              Change Password
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Enter your new password below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
              <Input id="new-password" type="password" placeholder="Enter new password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))} required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</Label>
              <Input id="confirm-password" type="password" placeholder="Confirm new password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))} required minLength={6} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPasswordDialogOpen(false)} className="flex-1">Cancel</Button>
              <Button type="submit" disabled={passwordLoading} className="flex-1 btn-dark">
                {passwordLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Welcome Wizard */}
        <WelcomeWizard
          open={showWelcome}
          userName={user?.email}
          onComplete={completeOnboarding}
        />

        {/* Quick company website patent search */}
        <div className="pricing-card !p-5 sm:!p-6 mb-6">
          <h3 className="text-base font-semibold text-foreground mb-1">Search patents by company website</h3>
          <p className="text-sm text-muted-foreground mb-3">Paste a company or product website. PatentBot reads it and runs a prior art search on what it does.</p>
          <form
            className="flex flex-col sm:flex-row gap-2"
            onSubmit={(e) => { e.preventDefault(); if (quickUrl.trim()) navigate(`/check?url=${encodeURIComponent(quickUrl.trim())}`); }}
          >
            <Input placeholder="e.g., yourcompany.com" value={quickUrl} onChange={(e) => setQuickUrl(e.target.value)} className="h-10" />
            <Button type="submit" disabled={!quickUrl.trim()} className="btn-dark h-10 rounded-xl text-sm">
              <Search className="h-4 w-4" />
              Run Search
            </Button>
          </form>
        </div>

        {/* Action Cards */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 mb-10">
          {/* File Patent */}
          <div className="pricing-card-featured !p-6 sm:!p-8">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-primary/8 flex items-center justify-center flex-shrink-0">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground">File Patent</h3>
                <p className="text-sm text-muted-foreground">AI-guided drafting</p>
              </div>
            </div>
            <div className="space-y-2 mb-5">
              {['USPTO-ready patent sections', 'Export to DOCX/PDF'].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-foreground">
                  <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="text-2xl font-bold text-foreground mb-1">{fullAccess ? 'Included' : <>{PATENT_APPLICATION_PRICE_DISPLAY}</>}</div>
            <p className="text-xs text-muted-foreground mb-4">{fullAccess ? 'Full access on your account' : 'One-time per application'}</p>
            <div className="space-y-2">
              <Button onClick={() => navigate('/new-application')} className="w-full btn-dark h-10 rounded-xl text-sm">
                Start New Patent
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button onClick={() => navigate('/drafts')} variant="outline" className="w-full h-10 rounded-xl text-sm border-border">
                Resume Drafts
              </Button>
            </div>
          </div>

          {/* Check & See */}
          <div className="pricing-card !p-6 sm:!p-8">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground">Patent Search</h3>
                <p className="text-sm text-muted-foreground">Check & See</p>
              </div>
            </div>
            <div className="space-y-2 mb-5">
              {['Multi-database search', 'AI similarity analysis'].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-foreground">
                  <CheckCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="text-2xl font-bold text-foreground mb-1">{fullAccess ? 'Included' : <>{CHECK_AND_SEE_PRICE_DISPLAY}</>}</div>
            <p className="text-xs text-muted-foreground mb-4">{fullAccess ? 'Full access on your account' : 'Monthly subscription'}</p>
            <Button onClick={() => navigate('/check')} variant="outline" className="w-full h-10 rounded-xl text-sm border-border">
              <Search className="h-4 w-4" />
              Search Patents
            </Button>
          </div>

          {/* Trademark Search */}
          <div className="pricing-card !p-6 sm:!p-8">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                <Tag className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground">Trademark Search</h3>
                <p className="text-sm text-muted-foreground">Clearance check</p>
              </div>
            </div>
            <div className="space-y-2 mb-5">
              {['USPTO TESS search', 'Conflict risk analysis'].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-foreground">
                  <CheckCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="text-2xl font-bold text-foreground mb-1">{fullAccess ? 'Included' : <>{TRADEMARK_SEARCH_PRICE_DISPLAY}</>}</div>
            <p className="text-xs text-muted-foreground mb-4">{fullAccess ? 'Full access on your account' : 'Monthly subscription'}</p>
            <Button onClick={() => navigate('/trademark-check')} variant="outline" className="w-full h-10 rounded-xl text-sm border-border">
              <Tag className="h-4 w-4" />
              Search Trademarks
            </Button>
          </div>

          {/* Trademark Filing */}
          <div className="pricing-card !p-6 sm:!p-8">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                <PenTool className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground">Trademark Filing</h3>
                <p className="text-sm text-muted-foreground">AI-guided application</p>
              </div>
            </div>
            <div className="space-y-2 mb-5">
              {['AI goods/services classification', 'Filing readiness review', 'Specimen guidance'].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-foreground">
                  <CheckCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="text-2xl font-bold text-foreground mb-1">{fullAccess ? 'Included' : <>{TRADEMARK_FILING_PRICE_DISPLAY}</>}</div>
            <p className="text-xs text-muted-foreground mb-4">{fullAccess ? 'Full access on your account' : 'Per application'}</p>
            <Button onClick={() => navigate('/trademark-application')} variant="outline" className="w-full h-10 rounded-xl text-sm border-border">
              <PenTool className="h-4 w-4" />
              Draft Application
            </Button>
          </div>
        </div>

        {/* Portfolio Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-[-0.03em] mb-2">
            Your Patent Portfolio
          </h2>
          <p className="text-sm text-muted-foreground">
            Track your applications, manage ideas, and monitor your IP.
          </p>
        </div>

        {/* Stats */}
        <PortfolioStatsSection userId={user?.id} />

        {/* Navigation Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
          {[
            { title: 'Ideas Lab', desc: 'Capture & monitor innovations', detail: 'Save invention ideas and get notified when similar patents are filed.', icon: Sparkles, path: '/ideas', cta: 'Explore Ideas' },
            { title: 'Pending Patents', desc: 'Track application progress', detail: 'View applications in progress and continue drafting where you left off.', icon: Clock, path: '/pending', cta: 'View Applications' },
            { title: 'Active Patents', desc: 'Protect your IP assets', detail: 'View your filed patents and track maintenance deadlines.', icon: Shield, path: '/active', cta: 'Manage Portfolio' },
          ].map((card, i) => (
            <div
              key={i}
              className="nav-card p-5 sm:p-6 group"
              onClick={() => navigate(card.path)}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/12 transition-colors">
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">{card.title}</h3>
                  <p className="text-xs text-muted-foreground">{card.desc}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">
                {card.detail}
              </p>
              <div className="flex items-center gap-1.5 text-primary text-sm font-medium group-hover:gap-2.5 transition-all">
                <span>{card.cta}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          ))}
        </div>

        {/* Monitoring Widgets */}
        {user?.id && (
          <div className="grid gap-4 sm:grid-cols-2 mb-10">
            <PriorArtMonitoringDashboard userId={user.id} />
            <TrademarkMonitoringDashboard userId={user.id} />
          </div>
        )}


        <div className="text-center bg-card border border-border rounded-2xl p-8 sm:p-12" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
            Ready to Protect Your Innovation?
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-lg mx-auto">
            From idea to USPTO filing — AI-powered patent drafting.
          </p>
          <Button 
            onClick={() => navigate('/new-application')} 
            className="btn-dark group px-8 py-5 h-auto text-base rounded-2xl"
          >
            <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" />
            Start Patent Application
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </main>
    </div>
  );
};

function PortfolioStatsSection({ userId }: { userId: string | undefined }) {
  const { counts: stats, loading, error, refetch } = usePortfolioCounts(userId);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse" style={{ boxShadow: 'var(--shadow-xs)' }}>
            <div className="h-12 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">We couldn't load your portfolio numbers right now.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  const items = [
    { label: 'Applications', value: stats.totalApplications, icon: FileText, color: 'text-primary' },
    { label: 'Active Patents', value: stats.activePatents, icon: Shield, color: 'text-primary' },
    { label: 'Ideas', value: stats.totalIdeas, icon: Lightbulb, color: 'text-primary' },
    { label: 'Alerts', value: stats.unreadAlerts, icon: AlertTriangle, color: 'text-primary' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {items.map((item, i) => (
        <div key={i} className="bg-card border border-border rounded-2xl p-4 sm:p-5 transition-all duration-300 hover:shadow-card" style={{ boxShadow: 'var(--shadow-xs)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0">
              <item.icon className={`h-5 w-5 ${item.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Dashboard;
