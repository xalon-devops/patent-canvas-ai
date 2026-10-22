import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { TreePine, Info, ShieldCheck, AlertTriangle } from 'lucide-react';

interface ClaimNode {
  id: string;
  claim_number: number;
  claim_type: 'independent' | 'dependent';
  parent_claim: number | null;
  elements: string[];
  full_text: string;
  rationale: string | null;
  rejection_risk_score: number | null;
}

interface Props {
  sessionId: string;
  refreshKey?: number;
}

const ClaimTreeView: React.FC<Props> = ({ sessionId, refreshKey }) => {
  const [claims, setClaims] = useState<ClaimNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('patent_claim_tree')
        .select('*')
        .eq('session_id', sessionId)
        .order('claim_number');
      if (error) console.error('Error loading claim tree:', error);
      if (!cancelled) {
        setClaims((data as ClaimNode[] | null) ?? []);
        setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, refreshKey]);

  if (loading) return null;
  if (claims.length === 0) return null;

  const independents = claims.filter((c) => c.claim_type === 'independent');
  const byNumber = new Map(claims.map((c) => [c.claim_number, c]));
  // Resolve each dependent claim to its root independent claim (handles claim 5 -> claim 3 -> claim 1 chains)
  const rootOf = (claim: ClaimNode): number | null => {
    let node: ClaimNode | undefined = claim;
    const seen = new Set<number>();
    while (node && node.claim_type === 'dependent' && node.parent_claim != null && !seen.has(node.claim_number)) {
      seen.add(node.claim_number);
      node = byNumber.get(node.parent_claim);
    }
    return node && node.claim_type === 'independent' ? node.claim_number : null;
  };
  const orphans = claims.filter((c) => c.claim_type === 'dependent' && rootOf(c) === null);

  const scoreColor = (score: number | null) => {
    if (score === null) return 'bg-muted text-muted-foreground';
    if (score >= 85) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TreePine className="h-5 w-5 text-primary" />
            Claim Tree
          </CardTitle>
          <CardDescription>
            Structured claim dependencies with AI reasoning. Hover any claim for the rationale.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {independents.map((indep) => {
            const dependents = claims.filter((c) => c.claim_type === 'dependent' && rootOf(c) === indep.claim_number);
            return (
              <div key={indep.id} className="space-y-2">
                <ClaimRow claim={indep} scoreColor={scoreColor} />
                {dependents.length > 0 && (
                  <div className="ml-2 sm:ml-6 border-l-2 border-muted pl-2 sm:pl-4 space-y-2">
                    {dependents.map((dep) => (
                      <ClaimRow key={dep.id} claim={dep} scoreColor={scoreColor} isDependent />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {orphans.length > 0 && (
            <div className="space-y-2">
              {orphans.map((dep) => (
                <ClaimRow key={dep.id} claim={dep} scoreColor={scoreColor} isDependent />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

const ClaimRow: React.FC<{
  claim: ClaimNode;
  scoreColor: (s: number | null) => string;
  isDependent?: boolean;
}> = ({ claim, scoreColor, isDependent }) => (
  <div className={`rounded-md border p-3 ${isDependent ? 'bg-muted/30' : 'bg-background'}`}>
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={isDependent ? 'outline' : 'default'}>Claim {claim.claim_number}</Badge>
        <Badge variant="secondary" className="text-xs">
          {claim.claim_type}
        </Badge>
        {claim.parent_claim && (
          <Badge variant="outline" className="text-xs">
            depends on {claim.parent_claim}
          </Badge>
        )}
        {claim.rejection_risk_score !== null && (
          <Badge className={`text-xs border ${scoreColor(claim.rejection_risk_score)}`} variant="outline">
            {claim.rejection_risk_score >= 85 ? (
              <ShieldCheck className="h-3 w-3 mr-1 inline" />
            ) : (
              <AlertTriangle className="h-3 w-3 mr-1 inline" />
            )}
            Score {claim.rejection_risk_score}
          </Badge>
        )}
      </div>
      {claim.rationale && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-muted-foreground cursor-help flex-shrink-0" />
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <p className="text-xs font-medium mb-1">Drafter's rationale</p>
            <p className="text-xs">{claim.rationale}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{claim.full_text}</p>
  </div>
);

export default ClaimTreeView;
