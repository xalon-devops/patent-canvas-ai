import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Plus, FileText, Clock, CheckCircle, Scale, LogOut, Sparkles, Search, Shield, Settings, Key, MoreVertical, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { validatePatentIdea, sanitizeText, createSafeErrorMessage } from '@/utils/security';

interface PatentSession {
  id: string;
  idea_prompt: string;
  status: string;
  created_at: string;
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<PatentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchingPriorArt, setSearchingPriorArt] = useState(false);
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
        fetchSessions(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchSessions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('patent_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading sessions",
        description: createSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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

  const createNewSession = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('patent_sessions')
        .insert([
          {
            user_id: user.id,
            status: 'in_progress'
          }
        ])
        .select()
        .single();

      if (error) throw error;
      
      navigate(`/session/${data.id}`);
    } catch (error: any) {
      toast({
        title: "Error creating session",
        description: createSafeErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const performLensAPISearch = async (sessionId: string) => {
    setSearchingPriorArt(true);
    
    try {
      console.log('Calling search-prior-art edge function with Lens API...');
      
      const { data: searchData, error: searchError } = await supabase.functions.invoke('search-prior-art', {
        body: { session_id: sessionId }
      });

      if (searchError) {
        console.error('Lens API search error:', searchError);
        throw new Error(searchError.message || 'Failed to search prior art with Lens API');
      }

      if (!searchData?.success) {
        console.error('Lens API search failed:', searchData);
        throw new Error('Lens API search failed');
      }

      console.log('Lens API search completed successfully:', searchData);
      
      toast({
        title: "Lens API Search Complete",
        description: `Found ${searchData.results_found} relevant patents`,
        variant: "default",
      });

      // Redirect to the session to see results
      navigate(`/session/${sessionId}`);
      
    } catch (error: any) {
      console.error('Error in Lens API search:', error);
      toast({
        title: "Search Failed",
        description: createSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSearchingPriorArt(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'filed':
        return <FileText className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Draft Complete';
      case 'filed':
        return 'Filed';
      case 'in_progress':
        return 'In Progress';
      default:
        return 'Unknown';
    }
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
                  <div className="relative rounded-2xl p-2 bg-white/20 backdrop-blur-md border border-white/30 shadow-lg">
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
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>Start New Patent ($1,000)</>
                )}
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
                variant="secondary" 
                className="w-full"
                onClick={() => navigate('/pricing')}
              >
                Subscribe for Check & See
              </Button>
            </Card>
          </div>

          {/* Start New Patent CTA */}
          <div className="mb-8">
            <Card className="card-premium overflow-hidden relative group hover:shadow-glow/30 transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-glow opacity-5 group-hover:opacity-10 transition-opacity duration-500"></div>
              <CardContent className="p-8 sm:p-12 relative">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                  <div className="flex-1 text-center lg:text-left">
                    <h2 className="text-3xl sm:text-4xl font-bold mb-4 flex items-center justify-center lg:justify-start gap-3">
                      <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                        <Sparkles className="h-8 w-8 text-primary animate-pulse-glow" />
                      </div>
                      Ready to Start?
                    </h2>
                    <p className="text-lg text-muted-foreground mb-6 max-w-2xl">
                      Transform your innovative ideas into professional patent applications with AI assistance. 
                      Get started in minutes with our intelligent interview process.
                    </p>
                    <Button 
                      variant="gradient" 
                      size="xl"
                      onClick={createNewSession}
                      className="shadow-glow hover:shadow-glow/80 group/btn"
                    >
                      <Plus className="h-5 w-5 group-hover/btn:rotate-90 transition-transform duration-300" />
                      Start New Patent Application
                      <ArrowRight className="h-5 w-5 group-hover/btn:translate-x-1 transition-transform duration-300" />
                    </Button>
                  </div>
                  <div className="hidden lg:block">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-primary rounded-full blur-2xl opacity-20 animate-pulse-glow"></div>
                      <div className="relative w-40 h-40 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/10">
                        <FileText className="h-20 w-20 text-primary/60" />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sessions List */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-foreground">
                Your Patent Applications
              </h3>
              <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                {sessions.length} {sessions.length === 1 ? 'Patent' : 'Patents'}
              </div>
            </div>
            
            {sessions.length === 0 ? (
              <Card className="card-premium">
                <CardContent className="p-12 text-center">
                  <div className="w-20 h-20 bg-gradient-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText className="h-10 w-10 text-primary" />
                  </div>
                  <h4 className="text-xl font-semibold mb-3">No patents yet</h4>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Start your first patent application to see it here. Our AI will guide you through the entire process.
                  </p>
                  <Button variant="gradient" size="lg" onClick={createNewSession} className="shadow-glow">
                    <Plus className="h-5 w-5" />
                    Create Your First Patent
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 lg:gap-6">
                {sessions.map((patentSession, index) => (
                  <Card 
                    key={patentSession.id} 
                    className="card-premium group cursor-pointer transition-all duration-300 hover:shadow-glow/20 hover:scale-[1.01] fade-in"
                    style={{ '--stagger': index } as React.CSSProperties}
                    onClick={() => navigate(`/session/${patentSession.id}`)}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg flex items-center gap-3 mb-2 group-hover:text-primary transition-colors duration-200">
                            <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors duration-200">
                              {getStatusIcon(patentSession.status)}
                            </div>
                            <span className="truncate">
                              {patentSession.idea_prompt ? 
                                patentSession.idea_prompt.slice(0, 80) + (patentSession.idea_prompt.length > 80 ? '...' : '') :
                                'Untitled Patent Application'
                              }
                            </span>
                          </CardTitle>
                          <CardDescription className="text-sm flex items-center gap-4 flex-wrap">
                            <span>Created {format(new Date(patentSession.created_at), 'MMM d, yyyy')}</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                              {getStatusLabel(patentSession.status)}
                            </span>
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              performLensAPISearch(patentSession.id);
                            }}
                            disabled={searchingPriorArt}
                            className="bg-white/5 border-white/10 hover:bg-white/10"
                          >
                            {searchingPriorArt ? (
                              <Search className="h-3 w-3 animate-spin" />
                            ) : (
                              <Search className="h-3 w-3" />
                            )}
                            <span className="hidden sm:inline ml-2">Lens API</span>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;