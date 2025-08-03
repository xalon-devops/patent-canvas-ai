import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, Session as SupabaseSession } from '@supabase/supabase-js';
import { 
  ArrowLeft, 
  TreeDeciduous, 
  Edit3,
  RefreshCw,
  FileText,
  Brain,
  Layers
} from 'lucide-react';
import { format } from 'date-fns';
import { validatePatentSection, sanitizeHtml, createSafeErrorMessage } from '@/utils/security';

interface PatentSession {
  id: string;
  idea_prompt: string;
  status: string;
  created_at: string;
  user_id: string;
}

interface PatentSection {
  id: string;
  section_type: string;
  content: string;
  is_user_edited: boolean;
  created_at: string;
}

interface Claim {
  id: string;
  number: number;
  content: string;
  type: 'independent' | 'dependent';
  dependsOn?: number;
  isUserEdited: boolean;
  timestamp: string;
}

const Claims = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [patentSession, setPatentSession] = useState<PatentSession | null>(null);
  const [sections, setSections] = useState<PatentSection[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

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
        fetchSessionData();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, id]);

  const fetchSessionData = async () => {
    if (!id) return;
    
    try {
      // Fetch patent session
      const { data: sessionData, error: sessionError } = await supabase
        .from('patent_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (sessionError) throw sessionError;
      setPatentSession(sessionData);

      // Fetch sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('patent_sections')
        .select('*')
        .eq('session_id', id)
        .order('created_at', { ascending: true });

      if (sectionsError) throw sectionsError;
      setSections(sectionsData || []);

      // Parse claims from claims section
      const claimsSection = sectionsData?.find(s => s.section_type === 'claims');
      if (claimsSection && claimsSection.content) {
        const parsedClaims = parseClaimsFromContent(claimsSection.content, claimsSection.is_user_edited, claimsSection.created_at);
        setClaims(parsedClaims);
      }

    } catch (error: any) {
      toast({
        title: "Error loading claims",
        description: createSafeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const parseClaimsFromContent = (content: string, isUserEdited: boolean, timestamp: string): Claim[] => {
    const lines = content.split('\n').filter(line => line.trim());
    const claims: Claim[] = [];
    
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      
      // Match independent claims (e.g., "1. A system for...")
      const independentMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);
      if (independentMatch) {
        const number = parseInt(independentMatch[1]);
        const content = independentMatch[2];
        
        claims.push({
          id: `claim-${number}`,
          number,
          content,
          type: 'independent',
          isUserEdited,
          timestamp
        });
        return;
      }
      
      // Match dependent claims (e.g., "2. The system of claim 1, wherein...")
      const dependentMatch = trimmedLine.match(/^(\d+)\.\s+The\s+.+?of\s+claim\s+(\d+),?\s+(.+)/i);
      if (dependentMatch) {
        const number = parseInt(dependentMatch[1]);
        const dependsOn = parseInt(dependentMatch[2]);
        const content = dependentMatch[3];
        
        claims.push({
          id: `claim-${number}`,
          number,
          content: `The ${content}`,
          type: 'dependent',
          dependsOn,
          isUserEdited,
          timestamp
        });
        return;
      }
      
      // Fallback for other claim formats
      const numberMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);
      if (numberMatch) {
        const number = parseInt(numberMatch[1]);
        const content = numberMatch[2];
        
        // Determine if dependent based on content
        const isDependent = content.toLowerCase().includes('claim') || 
                           content.toLowerCase().includes('wherein') ||
                           content.toLowerCase().includes('further comprising');
        
        claims.push({
          id: `claim-${number}`,
          number,
          content,
          type: isDependent ? 'dependent' : 'independent',
          isUserEdited,
          timestamp
        });
      }
    });
    
    return claims.sort((a, b) => a.number - b.number);
  };

  const renderClaimsTree = () => {
    const independentClaims = claims.filter(c => c.type === 'independent');
    
    return (
      <div className="space-y-6">
        {independentClaims.map((independentClaim) => {
          const dependentClaims = claims.filter(c => c.type === 'dependent' && c.dependsOn === independentClaim.number);
          
          return (
            <Card key={independentClaim.id} className="shadow-card border-0 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      Independent Claim {independentClaim.number}
                      {independentClaim.isUserEdited && (
                        <Badge variant="secondary" className="text-xs">
                          User Edited
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs flex items-center gap-2 mt-1">
                      <span>🧠 Mixtral 8x7B</span>
                      <span>•</span>
                      <span>{format(new Date(independentClaim.timestamp), 'MMM d, h:mm a')}</span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-7"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-7"
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm leading-relaxed mb-4 p-3 bg-primary/5 rounded-lg border-l-2 border-primary">
                  {independentClaim.content}
                </p>
                
                {/* Dependent Claims */}
                {dependentClaims.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <TreeDeciduous className="h-3 w-3" />
                      Dependent Claims ({dependentClaims.length})
                    </h5>
                    <div className="pl-4 border-l-2 border-muted space-y-3">
                      {dependentClaims.map((dependentClaim) => (
                        <Card key={dependentClaim.id} className="bg-muted/20 border border-muted">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  Claim {dependentClaim.number}
                                  {dependentClaim.isUserEdited && (
                                    <Badge variant="secondary" className="text-xs">
                                      User Edited
                                    </Badge>
                                  )}
                                </CardTitle>
                                <CardDescription className="text-xs flex items-center gap-2 mt-1">
                                  <span>🧠 Mixtral 8x7B</span>
                                  <span>•</span>
                                  <span>Depends on Claim {dependentClaim.dependsOn}</span>
                                </CardDescription>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-6"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-6"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <p className="text-sm leading-relaxed p-2 bg-background/80 rounded">
                              {dependentClaim.content}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading claims...</p>
        </div>
      </div>
    );
  }

  if (!patentSession) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Session not found</h2>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
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
              <Button 
                variant="ghost" 
                onClick={() => navigate(`/session/${id}`)}
                className="p-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold flex items-center gap-2">
                  <TreeDeciduous className="h-5 w-5 text-primary" />
                  Claims Tree
                </h1>
                <p className="text-sm text-muted-foreground">
                  {patentSession.idea_prompt ? 
                    patentSession.idea_prompt.slice(0, 60) + (patentSession.idea_prompt.length > 60 ? '...' : '') :
                    'Patent Claims Structure'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => navigate(`/session/${id}`)}
                className="hidden sm:flex"
              >
                <FileText className="h-4 w-4" />
                Back to Canvas
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {claims.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  Patent Claims Structure
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {claims.filter(c => c.type === 'independent').length} independent claims, {claims.filter(c => c.type === 'dependent').length} dependent claims
                </p>
              </div>
            </div>
            
            {renderClaimsTree()}
          </div>
        ) : (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center text-muted-foreground">
              <TreeDeciduous className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-medium mb-2">No claims found</h3>
              <p className="text-sm mb-4">Claims will appear here once the patent draft is generated</p>
              <Link to={`/session/${id}`}>
                <Button variant="outline">
                  <FileText className="h-4 w-4" />
                  Go to PatentBot AI™
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Claims;