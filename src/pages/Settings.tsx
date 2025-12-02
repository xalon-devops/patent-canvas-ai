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
      <div className="safe-area py-8">
        <div className="content-width max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Button>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
              Settings
            </h1>
            <p className="text-muted-foreground">
              Manage your account preferences and notifications
            </p>
          </div>

          {/* Account Info */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Account
              </CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium">{user?.email}</p>
              </div>
            </CardContent>
          </Card>

          {/* Email Preferences */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Email Notifications
              </CardTitle>
              <CardDescription>
                Choose which emails you'd like to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <Label htmlFor="draft_complete" className="font-medium">
                      Draft Complete
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when your patent draft is ready
                    </p>
                  </div>
                </div>
                <Switch
                  id="draft_complete"
                  checked={preferences.draft_complete}
                  onCheckedChange={() => handleToggle('draft_complete')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <CreditCard className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <Label htmlFor="payment_received" className="font-medium">
                      Payment Receipts
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receive confirmation when payments are processed
                    </p>
                  </div>
                </div>
                <Switch
                  id="payment_received"
                  checked={preferences.payment_received}
                  onCheckedChange={() => handleToggle('payment_received')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Shield className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <Label htmlFor="prior_art_alert" className="font-medium">
                      Prior Art Alerts
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get alerts when new prior art is found for your ideas
                    </p>
                  </div>
                </div>
                <Switch
                  id="prior_art_alert"
                  checked={preferences.prior_art_alert}
                  onCheckedChange={() => handleToggle('prior_art_alert')}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Mail className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <Label htmlFor="weekly_digest" className="font-medium">
                      Weekly Digest
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Weekly summary of your patent portfolio activity
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
