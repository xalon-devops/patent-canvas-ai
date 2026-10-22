import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Radar, Bell, Clock, AlertTriangle, CheckCircle, Loader2, RefreshCw, Plus, Trash2
} from 'lucide-react';
import { formatDateShort } from '@/lib/dateUtils';
import { getEdgeErrorMessage } from '@/lib/edgeError';
import { LIST_LIMIT, ownedByFilter } from '@/hooks/usePatentData';

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

interface WatchSource {
  sessions?: { id: string; idea_prompt: string | null; title?: string | null }[];
  ideas?: { id: string; title: string | null }[];
}

interface PriorArtMonitoringDashboardProps extends WatchSource {
  userId: string;
}

const MONITOR_LIMIT = 50;

/**
 * Prior-art watches for the user's ideas and applications.
 * Pass `sessions` / `ideas` when the page already loaded them to avoid refetching.
 */
export default function PriorArtMonitoringDashboard({ userId, sessions: sessionsProp, ideas: ideasProp }: PriorArtMonitoringDashboardProps) {
  const [monitors, setMonitors] = useState<MonitoringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [watchTargets, setWatchTargets] = useState<{ value: string; label: string }[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newQuery, setNewQuery] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchMonitors = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Watches are linked to the user's sessions and ideas (the table has no user_id)
      let sessions = sessionsProp;
      let ideas = ideasProp;
      if (!sessions || !ideas) {
        const [sRes, iRes] = await Promise.all([
          supabase.from('patent_sessions').select('id, idea_prompt, title').eq('user_id', userId)
            .order('created_at', { ascending: false }).limit(LIST_LIMIT),
          supabase.from('patent_ideas').select('id, title').eq('user_id', userId)
            .order('created_at', { ascending: false }).limit(LIST_LIMIT),
        ]);
        if (sRes.error) throw sRes.error;
        if (iRes.error) throw iRes.error;
        sessions = sRes.data || [];
        ideas = iRes.data || [];
      }

      const sessionIds = sessions.map(s => s.id);
      const ideaIds = ideas.map(i => i.id);

      // Options the user can attach a new watch to
      setWatchTargets([
        ...ideas.map(i => ({
          value: `idea:${i.id}`,
          label: i.title || 'Untitled idea',
        })),
        ...sessions.map(s => ({
          value: `session:${s.id}`,
          label: (s.title || s.idea_prompt || 'Untitled application').slice(0, 60),
        })),
      ]);

      if (sessionIds.length === 0 && ideaIds.length === 0) {
        setMonitors([]);
        return;
      }

      // Keep the `in.(...)` lists short; batch ids
      const batches: { s: string[]; i: string[] }[] = [];
      for (let k = 0; k < sessionIds.length; k += 80) batches.push({ s: sessionIds.slice(k, k + 80), i: [] });
      for (let k = 0; k < ideaIds.length; k += 80) batches.push({ s: [], i: ideaIds.slice(k, k + 80) });

      const results = await Promise.all(batches.map(b =>
        supabase.from('prior_art_monitoring')
          .select('id, search_query, is_active, results_found, new_results_count, highest_similarity_score, last_search_at, next_search_at, patent_idea_id, patent_session_id')
          .or(ownedByFilter(b.s, b.i))
          .order('last_search_at', { ascending: false })
          .limit(MONITOR_LIMIT)
      ));
      const rows: MonitoringRecord[] = [];
      for (const r of results) {
        if (r.error) throw r.error;
        rows.push(...((r.data || []) as MonitoringRecord[]));
      }
      rows.sort((x, y) => (y.last_search_at || '').localeCompare(x.last_search_at || ''));
      setMonitors(rows.slice(0, MONITOR_LIMIT));
    } catch (e: any) {
      console.error('Error fetching monitors:', e);
      setLoadError(e.message || 'Could not load monitoring.');
    } finally {
      setLoading(false);
    }
  }, [userId, sessionsProp, ideasProp]);

  useEffect(() => {
    if (userId) fetchMonitors();
  }, [userId, fetchMonitors]);

  const runMonitor = async (monitor: MonitoringRecord) => {
    setRunningId(monitor.id);
    try {
      const { data, error } = await supabase.functions.invoke('run-prior-art-monitoring', {
        body: {
          ideaId: monitor.patent_idea_id,
          sessionId: monitor.patent_session_id,
          searchQuery: monitor.search_query,
        }
      });
      if (error) throw new Error((await getEdgeErrorMessage(error, 'Monitoring run failed.')).message);
      if (data?.success === false) throw new Error(data?.error || 'Monitoring run failed.');
      toast({
        title: 'Monitoring Complete',
        description: `Found ${data?.resultsFound || 0} results. ${data?.highestSimilarity ? `Highest similarity: ${(data.highestSimilarity * 100).toFixed(0)}%` : ''}`,
      });
      await fetchMonitors();
    } catch (e: any) {
      toast({ title: 'Monitoring Failed', description: e.message, variant: 'destructive' });
    } finally {
      setRunningId(null);
    }
  };

  const createMonitor = async () => {
    if (!newQuery.trim() || !newTarget) return;
    setCreating(true);
    try {
      const [kind, targetId] = newTarget.split(':');
      const already = monitors.find(m => (kind === 'idea' ? m.patent_idea_id : m.patent_session_id) === targetId);
      if (already) throw new Error('That item already has a watch. Edit or remove the existing one first.');
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('prior_art_monitoring')
        .insert({
          search_query: newQuery.trim().slice(0, 1000),
          patent_idea_id: kind === 'idea' ? targetId : null,
          patent_session_id: kind === 'session' ? targetId : null,
          is_active: true,
          last_search_at: now,
          next_search_at: now, // due immediately
        });
      if (error) throw error;
      if (kind === 'idea') {
        await supabase.from('patent_ideas').update({ prior_art_monitoring: true }).eq('id', targetId);
      }
      setNewQuery('');
      setNewTarget('');
      setShowAdd(false);
      fetchMonitors();
    } catch (e: any) {
      toast({ title: "Couldn't add that watch", description: e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const deleteMonitor = async (monitor: MonitoringRecord) => {
    setDeletingId(monitor.id);
    try {
      const { data, error } = await supabase
        .from('prior_art_monitoring')
        .delete()
        .eq('id', monitor.id)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('This watch could not be removed. Refresh and try again.');
      setMonitors(prev => prev.filter(m => m.id !== monitor.id));
      // Keep the idea's monitoring flag in sync when its last watch is removed
      if (monitor.patent_idea_id && !monitors.some(m => m.id !== monitor.id && m.patent_idea_id === monitor.patent_idea_id)) {
        await supabase.from('patent_ideas').update({ prior_art_monitoring: false }).eq('id', monitor.patent_idea_id);
      }
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleActive = async (monitor: MonitoringRecord) => {
    try {
      const { error } = await supabase
        .from('prior_art_monitoring')
        .update({ is_active: !monitor.is_active })
        .eq('id', monitor.id);
      if (error) throw error;
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radar className="w-4 h-4 text-primary" />
            Prior Art Monitoring
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {monitors.filter(m => m.is_active).length} active
            </Badge>
            {watchTargets.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => setShowAdd(v => !v)}
              >
                <Plus className="w-2.5 h-2.5" />
                {showAdd ? 'Cancel' : 'Add watch'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0 space-y-2">
        {showAdd && (
          <div className="rounded-md border border-border p-2.5 space-y-2">
            <Input
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              placeholder="What should we keep watching for?"
              className="h-8 text-xs"
            />
            <Select value={newTarget} onValueChange={setNewTarget}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Attach to an idea or application" />
              </SelectTrigger>
              <SelectContent>
                {watchTargets.map(t => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="w-full h-8 text-xs"
              disabled={creating || !newQuery.trim() || !newTarget}
              onClick={createMonitor}
            >
              {creating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Start watching'}
            </Button>
          </div>
        )}
        {loadError ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-muted-foreground">{loadError}</p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={fetchMonitors}>Try again</Button>
          </div>
        ) : monitors.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No monitoring set up yet. Save an idea or create a patent application to enable monitoring.
          </p>
        ) : (
          monitors.map(monitor => (
            <div key={monitor.id} className="bg-muted/30 rounded-md p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium line-clamp-1 flex-1 min-w-0">{monitor.search_query}</p>
                <Switch
                  checked={monitor.is_active}
                  onCheckedChange={() => toggleActive(monitor)}
                  aria-label={monitor.is_active ? 'Pause this watch' : 'Resume this watch'}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDateShort(monitor.last_search_at)}
                </span>
                <span>{monitor.results_found} found</span>
                {monitor.highest_similarity_score != null && monitor.highest_similarity_score > 0 && (
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-8 gap-1"
                  disabled={runningId === monitor.id}
                  onClick={() => runMonitor(monitor)}
                >
                  {runningId === monitor.id ? (
                    <><Loader2 className="w-2.5 h-2.5 animate-spin" />Scanning…</>
                  ) : (
                    <><RefreshCw className="w-2.5 h-2.5" />Run Now</>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground hover:text-destructive"
                  disabled={deletingId === monitor.id}
                  onClick={() => deleteMonitor(monitor)}
                  aria-label="Remove this watch"
                >
                  {deletingId === monitor.id
                    ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    : <Trash2 className="w-2.5 h-2.5" />}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
