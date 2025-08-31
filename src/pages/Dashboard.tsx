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
import { Plus, FileText, Clock, CheckCircle, Scale, LogOut, Sparkles, Search, Shield, Settings, Key, MoreVertical, ArrowRight } from 'lucide-react';

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/auth');
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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
        <div className="safe-area">
          <div className="content-width">
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="relative rounded-2xl p-2 bg-white/60 backdrop-blur-md border border-white/50 shadow-lg">
                    <img 
                      src="https://i.ibb.co/Q32kGjnt/Patent-Bot-AI-Logo-Transparent.png" 
                      alt="PatentBot AI Logo" 
                      className="h-12 w-auto"
                    />
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                    PatentBot AI™
                  </h1>
                  <p className="text-sm text-muted-foreground hidden sm:block">
                    Welcome back, {user?.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="text-muted-foreground hover:text-foreground hidden sm:flex"
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </Button>
                
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

      <main className="safe-area py-8">
        <div className="content-width">
          {/* Pricing Cards */}
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:shadow-glow/30 transition-all duration-500">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">File Patent Application</h3>
                  <p className="text-muted-foreground">Complete AI-guided patent drafting</p>
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
              <Button 
                onClick={createNewSession} 
                className="w-full bg-primary hover:bg-primary/90"
              >
                Start New Patent ($1,000)
              </Button>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-secondary/5 to-secondary/10 border-secondary/20 hover:shadow-glow/30 transition-all duration-500">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-secondary/10 rounded-lg">
                  <Search className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Check & See</h3>
                  <p className="text-muted-foreground">Search for existing patents before you file</p>
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
                Start Searching ($9.99/month)
              </Button>
            </Card>
          </div>

          {/* Navigation Cards */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-4">Manage Your Patent Portfolio</h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Access all patent management tools from your centralized dashboard.
            </p>
          </div>

          {/* Navigation Menu */}
          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <Card 
              className="p-6 bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20 hover:shadow-glow/30 transition-all duration-500 cursor-pointer group"
              onClick={() => navigate('/ideas')}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-accent/10 rounded-lg group-hover:scale-110 transition-transform">
                  <Sparkles className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Ideas Lab</h3>
                  <p className="text-muted-foreground">Capture and refine patent ideas</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Document and develop your inventions before filing
              </p>
            </Card>

            <Card 
              className="p-6 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20 hover:shadow-glow/30 transition-all duration-500 cursor-pointer group"
              onClick={() => navigate('/pending')}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-500/10 rounded-lg group-hover:scale-110 transition-transform">
                  <Clock className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Pending Applications</h3>
                  <p className="text-muted-foreground">Track filed applications</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Monitor progress and prior art analysis
              </p>
            </Card>

            <Card 
              className="p-6 bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20 hover:shadow-glow/30 transition-all duration-500 cursor-pointer group"
              onClick={() => navigate('/active')}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-green-500/10 rounded-lg group-hover:scale-110 transition-transform">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Active Patents</h3>
                  <p className="text-muted-foreground">Manage granted patents</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                View portfolio and renewal dates
              </p>
            </Card>
          </div>

          {/* Start New Session Button */}
          <div className="text-center">
            <Button 
              onClick={createNewSession} 
              size="lg" 
              className="px-8 py-6 text-lg font-semibold bg-gradient-primary hover:scale-105 transform transition-all duration-200 shadow-glow"
            >
              <Plus className="h-5 w-5 mr-2" />
              Start New Patent Application
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;