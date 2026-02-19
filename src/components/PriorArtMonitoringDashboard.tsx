import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Radar, Bell, Clock, AlertTriangle, CheckCircle, Loader2, RefreshCw
} from 'lucide-react';
import { formatDate, formatDateShort } from '@/lib/dateUtils';

interface MonitoringRecord {
  id: string;
  search_query: string;
  is_active: boolean;
  results_found: number;
  new_results_count: number;
  highest_similarity_score: number | null;
  last_search_at: string;
  next_search_at: string | null;
  patent_idea_id: string | null;
  patent_session_id: string | null;
}

interface PriorArtMonitoringDashboardProps {
  userId: string;
}

export default function PriorArtMonitoringDashboard({ userId }: PriorArtMonitoringDashboardProps) {
  const [monitors, setMonitors] = useState<MonitoringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchMonitors = async () => {
    setLoading(true);
    try {
      // Fetch monitoring records linked to user's sessions and ideas
      const { data: sessions } = await supabase
        .from('patent_sessions')
        .select('id')
        .eq('user_id', userId);

      const { data: ideas } = await supabase
        .from('patent_ideas')
        .select('id')
        .eq('user_id', userId);

      const sessionIds = (sessions || []).map(s => s.id);
      const ideaIds = (ideas || []).map(i => i.id);

      if (sessionIds.length === 0 && ideaIds.length === 0) {
        setMonitors([]);
        setLoading(false);
        return;
      }

      let query = supabase.from('prior_art_monitoring').select('*');
      
      const orConditions: string[] = [];
      if (sessionIds.length > 0) {
        orConditions.push(`patent_session_id.in.(${sessionIds.join(',')})`);
      }
      if (ideaIds.length > 0) {
        orConditions.push(`patent_idea_id.in.(${ideaIds.join(',')})`);
      }
      
      if (orConditions.length > 0) {
        query = query.or(orConditions.join(','));
      }

      const { data, error } = await query.order('last_search_at', { ascending: false });
      if (error) throw error;
      setMonitors(data || []);
    } catch (e: any) {
      console.error('Error fetching monitors:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchMonitors();
  }, [userId]);

  const runMonitor = async (monitor: MonitoringRecord) => {
    setRunningId(monitor.id);
    try {
      const { data, error } = await supabase.functions.invoke('run-prior-art-monitoring', {
        body: {
          ideaId: monitor.patent_idea_id,
          sessionId: monitor.patent_session_id,
          searchQuery: monitor.search_query,
          userId,
        }
      });
      if (error) throw error;
      toast({
        title: 'Monitoring Complete',
        description: `Found ${data.resultsFound || 0} results. ${data.highestSimilarity ? `Highest similarity: ${(data.highestSimilarity * 100).toFixed(0)}%` : ''}`,
      });
      await fetchMonitors();
    } catch (e: any) {
      toast({ title: 'Monitoring Failed', description: e.message, variant: 'destructive' });
    } finally {
      setRunningId(null);
    }
  };

  const toggleActive = async (monitor: MonitoringRecord) => {
    try {
      await supabase
        .from('prior_art_monitoring')
        .update({ is_active: !monitor.is_active })
        .eq('id', monitor.id);
      setMonitors(prev => prev.map(m => m.id === monitor.id ? { ...m, is_active: !m.is_active } : m));
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radar className="w-4 h-4 text-primary" />
            Prior Art Monitoring
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            {monitors.filter(m => m.is_active).length} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0 space-y-2">
        {monitors.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No monitoring set up yet. Save an idea or create a patent application to enable monitoring.
          </p>
        ) : (
          monitors.map(monitor => (
            <div key={monitor.id} className="bg-muted/30 rounded-md p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium line-clamp-1 flex-1">{monitor.search_query}</p>
                <Switch
                  checked={monitor.is_active}
                  onCheckedChange={() => toggleActive(monitor)}
                  className="scale-75"
                />
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDateShort(monitor.last_search_at)}
                </span>
                <span>{monitor.results_found} found</span>
                {monitor.highest_similarity_score && (
                  <Badge className={`text-[9px] px-1 py-0 ${
                    monitor.highest_similarity_score > 0.7 ? 'bg-red-500' : 
                    monitor.highest_similarity_score > 0.4 ? 'bg-amber-500' : 'bg-green-500'
                  }`}>
                    {(monitor.highest_similarity_score * 100).toFixed(0)}% max
                  </Badge>
                )}
                {monitor.new_results_count > 0 && (
                  <Badge className="bg-primary text-[9px] px-1 py-0">
                    <Bell className="w-2 h-2 mr-0.5" />{monitor.new_results_count} new
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-[10px] h-6 gap-1"
                disabled={runningId === monitor.id}
                onClick={() => runMonitor(monitor)}
              >
                {runningId === monitor.id ? (
                  <><Loader2 className="w-2.5 h-2.5 animate-spin" />Scanning…</>
                ) : (
                  <><RefreshCw className="w-2.5 h-2.5" />Run Now</>
                )}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
