import { ProtectedHeader } from '@/components/ProtectedHeader';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { formatDateTime } from '@/lib/dateUtils';
import { validatePatentSection, sanitizeHtml, createSafeErrorMessage } from '@/utils/security';
import DOMPurify from 'dompurify';
import { PageSEO } from '@/components/SEO';

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
      // Session, sections and the structured claim tree in parallel (RLS scopes each to the owner)
      const [sessionRes, sectionsRes, treeRes] = await Promise.all([
        supabase.from('patent_sessions').select('*').eq('id', id).maybeSingle(),
        supabase.from('patent_sections').select('*').eq('session_id', id).order('created_at', { ascending: true }),
        supabase.from('patent_claim_tree').select('claim_number, claim_type, parent_claim, full_text, created_at').eq('session_id', id).order('claim_number'),
      ]);

      if (sessionRes.error) throw sessionRes.error;
      if (!sessionRes.data) {
        setPatentSession(null);
        return;
      }
      if (sectionsRes.error) throw sectionsRes.error;
      setPatentSession(sessionRes.data);
      const sectionsData = sectionsRes.data || [];
      setSections(sectionsData);

      const claimsSection = sectionsData.find(s => s.section_type === 'claims');
      const treeRows = treeRes.error ? [] : (treeRes.data || []);

      // Prefer the structured claim tree from the AI pipeline unless the claims text was edited by hand afterwards
      if (treeRows.length > 0 && !claimsSection?.is_user_edited) {
        setClaims(treeRows.map((r) => ({
          id: `claim-${r.claim_number}`,
          number: r.claim_number,
          content: r.full_text.replace(/^\s*\d+[.):]\s*/, ''),
          type: r.claim_type === 'dependent' ? 'dependent' : 'independent',
          dependsOn: r.parent_claim ?? undefined,
          isUserEdited: false,
          timestamp: r.created_at,
        })));
      } else if (claimsSection && claimsSection.content) {
        setClaims(parseClaimsFromContent(claimsSection.content, claimsSection.is_user_edited, claimsSection.created_at));
      } else {
        setClaims([]);
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
    // Turn block-level HTML into line breaks first so "<p>1. ...</p><p>2. ...</p>" doesn't collapse into one line
    const textContent = content
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
    
    const lines = textContent.split(/\n+/).map(line => line.trim()).filter(Boolean);
    const byNumber = new Map<number, Claim>();
    let current: Claim | null = null;
    
    lines.forEach((line) => {
      // Start of a claim, e.g. "1. A system for..." or "Claim 1: A method..."
      const match = line.match(/^(?:Claim\s+)?(\d+)\s*[.:)]\s*(.+)/i);
      if (match) {
        const number = parseInt(match[1], 10);
        const claimContent = match[2].trim();
        const dependentMatch = claimContent.match(/\b(?:of|to|in)\s+claim\s+(\d+)/i);
        const dependsOn = dependentMatch ? parseInt(dependentMatch[1], 10) : undefined;
        current = {
          id: `claim-${number}`,
          number,
          content: claimContent,
          type: dependsOn && dependsOn !== number ? 'dependent' : 'independent',
          dependsOn: dependsOn && dependsOn !== number ? dependsOn : undefined,
          isUserEdited,
          timestamp,
        };
        if (!byNumber.has(number)) byNumber.set(number, current);
        return;
      }
      // Continuation line (claim elements on their own lines) belongs to the previous claim
      if (current) current.content = `${current.content}\n${line}`;
    });
    
    return Array.from(byNumber.values()).sort((a, b) => a.number - b.number);
  };

  // Walk up the dependency chain so claims that depend on a dependent claim still appear under their root
  const getRootClaimNumber = (claim: Claim): number => {
    const byNumber = new Map(claims.map(c => [c.number, c]));
    let node: Claim | undefined = claim;
    const seen = new Set<number>();
    while (node && node.type === 'dependent' && node.dependsOn !== undefined && !seen.has(node.number)) {
      seen.add(node.number);
      const parent = byNumber.get(node.dependsOn);
      if (!parent) break;
      node = parent;
    }
    return node?.number ?? claim.number;
  };

  const renderClaimsTree = () => {
    const independentClaims = claims.filter(c => c.type === 'independent');
    const independentNumbers = new Set(independentClaims.map(c => c.number));
    // Dependent claims whose chain doesn't resolve to an independent claim are shown on their own
    const orphanClaims = claims.filter(c => c.type === 'dependent' && !independentNumbers.has(getRootClaimNumber(c)));
    
    return (
      <div className="space-y-6">
        {independentClaims.map((independentClaim) => {
          const dependentClaims = claims.filter(c => c.type === 'dependent' && getRootClaimNumber(c) === independentClaim.number);
          
          return (
            <Card key={independentClaim.id} className="shadow-card border-0 bg-card/90 backdrop-blur-sm">
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
                      <span>🧠 AI Generated</span>
                      <span>•</span>
                      <span>{formatDateTime(independentClaim.timestamp)}</span>
                    </CardDescription>
                  </div>
                  {/* Editing and regeneration happen in the full editor */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => navigate(`/session/${id}`)}
                  >
                    <Edit3 className="h-3 w-3" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div 
                  className="text-sm leading-relaxed mb-4 p-3 bg-primary/5 rounded-lg border-l-2 border-primary whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(independentClaim.content) }}
                />
                
                {/* Dependent Claims */}
                {dependentClaims.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <TreeDeciduous className="h-3 w-3" />
                      Dependent Claims ({dependentClaims.length})
                    </h5>
                    <div className="pl-4 border-l-2 border-muted space-y-3">
                      {dependentClaims.map((dependentClaim) => (
                        <Card key={dependentClaim.id} className="bg-muted/30 border border-muted">
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
                                  <span>🧠 AI Generated</span>
                                  <span>•</span>
                                  <span>Depends on Claim {dependentClaim.dependsOn}</span>
                                </CardDescription>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 gap-1 text-xs"
                                onClick={() => navigate(`/session/${id}`)}
                              >
                                <Edit3 className="h-3 w-3" />
                                Edit
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div 
                              className="text-sm leading-relaxed p-2 bg-background/80 rounded whitespace-pre-wrap break-words"
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(dependentClaim.content) }}
                            />
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
        {orphanClaims.length > 0 && (
          <Card className="shadow-card border-0 bg-card/90 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Other Dependent Claims</CardTitle>
              <CardDescription className="text-xs">These reference claims that weren't found in the claim set</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {orphanClaims.map((c) => (
                <div key={c.id} className="text-sm p-2 bg-muted/30 rounded whitespace-pre-wrap break-words">
                  <span className="font-medium">Claim {c.number}</span> (depends on {c.dependsOn}): {c.content}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
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
      <PageSEO.Claims />
      {/* Header */}
      <ProtectedHeader title="Claims Tree" backTo={`/session/${id}`} backLabel="Patent Canvas" />

      <div className="container mx-auto px-4 py-6">
        {claims.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
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
              <Button onClick={() => navigate(`/session/${id}`)} className="bg-primary hover:bg-primary/90">
                <FileText className="h-4 w-4 mr-2" />
                Go to Patent Canvas
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Claims;