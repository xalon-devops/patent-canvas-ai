import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { ArrowLeft, Bell, Mail, FileText, CreditCard, Shield, Loader2, ExternalLink } from 'lucide-react';
import { PageSEO } from '@/components/SEO';
import { formatDate } from '@/lib/dateUtils';
import {
  CHECK_AND_SEE_PRICE,
  TRADEMARK_SEARCH_PRICE,
} from '@/lib/pricingConstants';

/** Turns a stored plan slug into the customer-facing product name and price. */
const formatPlanName = (plan: string): string => {
  const normalized = (plan || '').toLowerCase();
  if (normalized.includes('trademark')) {
    return `Trademark Suite — $${TRADEMARK_SEARCH_PRICE}/mo`;
  }
  if (normalized.includes('check') || normalized.includes('search') || normalized === 'premium') {
    return `Check & See — $${CHECK_AND_SEE_PRICE}/mo`;
  }
  return plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Subscription';
};

interface EmailPreferences {
  draft_complete: boolean;
  payment_received: boolean;
  prior_art_alert: boolean;
  trademark_alert: boolean;
  weekly_digest: boolean;
}

interface SubscriptionRow {
  id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
}

const defaultPreferences: EmailPreferences = {
  draft_complete: true,
  payment_received: true,
  prior_art_alert: true,
  trademark_alert: true,
  weekly_digest: true,
};

const Settings = () => {
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<EmailPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [portalLoading, setPortalLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();


  useEffect(() => {
    const loadUserAndPreferences = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/auth');
        return;
      }
      setUser(session.user);

      // Load email preferences from users table
      const { data: userData, error } = await supabase
        .from('users')
        .select('email_preferences')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading email preferences:', error);
        toast({ title: "Couldn't load your preferences", description: 'Showing defaults. Please refresh to try again.', variant: 'destructive' });
      }

      if (userData?.email_preferences) {
        const prefs = userData.email_preferences as unknown as EmailPreferences;
        setPreferences({
          ...defaultPreferences,
          ...prefs
        });
      }

      // Load active subscriptions so the user can see and manage what they pay for
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('id, plan, status, current_period_end')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      setSubscriptions((subData as SubscriptionRow[]) ?? []);

      setLoading(false);
    };


    loadUserAndPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const activeSubscriptions = subscriptions.filter(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  );

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (!data?.url) throw new Error('No billing portal link was returned.');
      window.location.href = data.url as string;
    } catch (error) {
      console.error('Error opening billing portal:', error);
      toast({
        title: "Couldn't open billing",
        description: error instanceof Error ? error.message : 'Please try again in a moment.',
        variant: "destructive",
      });
      setPortalLoading(false);
    }
  };

  const handleToggle = (key: keyof EmailPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Single atomic upsert — a select-then-insert/update pair can race and throw a duplicate key
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          email_preferences: preferences
        } as any, { onConflict: 'id' });
      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your email preferences have been updated.",
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error saving settings",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PageSEO.Settings />
      <div className="safe-area py-6 sm:py-8 px-4 sm:px-6">
        <div className="content-width max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Dashboard</span>
            </Button>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-1">
              Settings
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your preferences
            </p>
          </div>

          {/* Account Info */}
          <Card className="mb-4">
            <CardHeader className="pb-2 p-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="w-4 h-4" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="text-sm font-medium truncate">{user?.email}</p>
              </div>
            </CardContent>
          </Card>

          {/* Billing & Subscription */}
          <Card className="mb-4">
            <CardHeader className="pb-2 p-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="w-4 h-4" />
                Billing &amp; Subscription
              </CardTitle>
              <CardDescription className="text-xs">
                View your plans, update your card, or cancel at any time.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {activeSubscriptions.length > 0 ? (
                <div className="space-y-2">
                  {activeSubscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{formatPlanName(sub.plan)}</p>
                        {sub.current_period_end && (
                          <p className="text-xs text-muted-foreground">
                            Renews {formatDate(sub.current_period_end)}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-medium text-green-600 capitalize flex-shrink-0">
                        {sub.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You don't have an active subscription.
                </p>
              )}

              <div className="flex flex-col xs:flex-row gap-2">
                <Button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  variant={activeSubscriptions.length > 0 ? 'default' : 'outline'}
                  className="gap-2"
                >
                  {portalLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  {portalLoading ? 'Opening…' : 'Manage billing'}
                </Button>
                {activeSubscriptions.length === 0 && (
                  <Button variant="ghost" onClick={() => navigate('/pricing')} className="gap-2">
                    View plans
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Billing is handled securely by Stripe. Cancelling stops future charges; you keep
                access until the end of the period you've paid for.
              </p>
            </CardContent>
          </Card>

          {/* Email Preferences */}
          <Card className="mb-4">
            <CardHeader className="pb-2 p-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="w-4 h-4" />
                Email Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0">
                    <FileText className="w-3 h-3 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="draft_complete" className="text-sm font-medium">
                      Draft Complete
                    </Label>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      When your patent draft is ready
                    </p>
                  </div>
                </div>
                <Switch
                  id="draft_complete"
                  checked={preferences.draft_complete}
                  onCheckedChange={() => handleToggle('draft_complete')}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 bg-green-500/10 rounded-lg flex-shrink-0">
                    <CreditCard className="w-3 h-3 text-green-500" />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="payment_received" className="text-sm font-medium">
                      Payment Receipts
                    </Label>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      Payment confirmations
                    </p>
                  </div>
                </div>
                <Switch
                  id="payment_received"
                  checked={preferences.payment_received}
                  onCheckedChange={() => handleToggle('payment_received')}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 bg-orange-500/10 rounded-lg flex-shrink-0">
                    <Shield className="w-3 h-3 text-orange-500" />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="prior_art_alert" className="text-sm font-medium">
                      Prior Art Alerts
                    </Label>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      New prior art for your ideas
                    </p>
                  </div>
                </div>
                <Switch
                  id="prior_art_alert"
                  checked={preferences.prior_art_alert}
                  onCheckedChange={() => handleToggle('prior_art_alert')}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 bg-purple-500/10 rounded-lg flex-shrink-0">
                    <Bell className="w-3 h-3 text-purple-500" />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="trademark_alert" className="text-sm font-medium">
                      Trademark Alerts
                    </Label>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      Conflicting marks found by trademark monitoring
                    </p>
                  </div>
                </div>
                <Switch
                  id="trademark_alert"
                  checked={preferences.trademark_alert}
                  onCheckedChange={() => handleToggle('trademark_alert')}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 bg-blue-500/10 rounded-lg flex-shrink-0">
                    <Mail className="w-3 h-3 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="weekly_digest" className="text-sm font-medium">
                      Digest &amp; Product Updates
                    </Label>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      Activity summaries, tips &amp; occasional product updates
                    </p>
                  </div>
                </div>
                <Switch
                  id="weekly_digest"
                  checked={preferences.weekly_digest}
                  onCheckedChange={() => handleToggle('weekly_digest')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
