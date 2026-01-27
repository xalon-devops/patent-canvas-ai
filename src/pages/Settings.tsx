import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { ArrowLeft, Bell, Mail, FileText, CreditCard, Shield, Loader2 } from 'lucide-react';
import { PageSEO } from '@/components/SEO';

interface EmailPreferences {
  draft_complete: boolean;
  payment_received: boolean;
  prior_art_alert: boolean;
  weekly_digest: boolean;
}

const defaultPreferences: EmailPreferences = {
  draft_complete: true,
  payment_received: true,
  prior_art_alert: true,
  weekly_digest: true,
};

const Settings = () => {
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<EmailPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        .single();

      if (userData?.email_preferences) {
        const prefs = userData.email_preferences as unknown as EmailPreferences;
        setPreferences({
          ...defaultPreferences,
          ...prefs
        });
      }
      setLoading(false);
    };

    loadUserAndPreferences();
  }, [navigate]);

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
      // First check if user record exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();

      if (existingUser) {
        // Update existing record
        const { error } = await supabase
          .from('users')
          .update({ email_preferences: preferences } as any)
          .eq('id', user.id);
        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('users')
          .insert([{
            id: user.id,
            email: user.email,
            email_preferences: preferences
          }] as any);
        if (error) throw error;
      }

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
                  <div className="p-1.5 bg-blue-500/10 rounded-lg flex-shrink-0">
                    <Mail className="w-3 h-3 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="weekly_digest" className="text-sm font-medium">
                      Weekly Digest
                    </Label>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      Weekly activity summary
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
