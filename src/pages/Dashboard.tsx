import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Plus, FileText, Clock, CheckCircle, Scale, LogOut, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

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
        description: error.message,
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
        description: error.message,
        variant: "destructive",
      });
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
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-primary rounded-full blur-lg opacity-20"></div>
                <div className="relative bg-primary rounded-full p-2">
                  <Scale className="h-5 w-5 text-primary-foreground" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Patent Canvas AI
                </h1>
                <p className="text-sm text-muted-foreground">
                  Welcome back, {user?.email}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* New Patent Button */}
        <div className="mb-8">
          <Card className="shadow-elegant border-0 bg-gradient-primary text-primary-foreground overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-glow opacity-10"></div>
            <CardContent className="p-8 relative">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    <Sparkles className="h-6 w-6" />
                    Start Your Next Patent
                  </h2>
                  <p className="text-primary-foreground/80 mb-4">
                    Transform your innovative ideas into professional patent applications with AI assistance
                  </p>
                  <Button 
                    variant="secondary" 
                    onClick={createNewSession}
                    className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:shadow-glow transition-smooth"
                  >
                    <Plus className="h-4 w-4" />
                    Start New Patent
                  </Button>
                </div>
                <div className="hidden md:block">
                  <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center">
                    <FileText className="h-16 w-16 text-white/60" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sessions List */}
        <div>
          <h3 className="text-xl font-semibold mb-4 text-foreground">
            Your Patent Applications
          </h3>
          
          {sessions.length === 0 ? (
            <Card className="shadow-card border-0 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h4 className="text-lg font-medium mb-2">No patents yet</h4>
                <p className="text-muted-foreground mb-4">
                  Start your first patent application to see it here
                </p>
                <Button variant="gradient" onClick={createNewSession}>
                  <Plus className="h-4 w-4" />
                  Create Your First Patent
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sessions.map((patentSession) => (
                <Card 
                  key={patentSession.id} 
                  className="shadow-card border-0 bg-card/80 backdrop-blur-sm hover:shadow-elegant transition-smooth cursor-pointer"
                  onClick={() => navigate(`/session/${patentSession.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2 mb-1">
                          {getStatusIcon(patentSession.status)}
                          {patentSession.idea_prompt ? 
                            patentSession.idea_prompt.slice(0, 80) + (patentSession.idea_prompt.length > 80 ? '...' : '') :
                            'Untitled Patent Application'
                          }
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Created {format(new Date(patentSession.created_at), 'MMM d, yyyy')}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          {getStatusLabel(patentSession.status)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;