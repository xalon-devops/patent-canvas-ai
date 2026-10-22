import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Tag, Bell, Clock, Loader2, RefreshCw, Plus, Trash2
} from 'lucide-react';
import { formatDateShort } from '@/lib/dateUtils';

interface TrademarkMonitor {
  id: string;
  mark_name: string;
  search_query: string;
  nice_classes: string[];
  is_active: boolean;
  results_found: number;
  new_results_count: number;
  highest_similarity_score: number | null;
  last_search_at: string;
  next_search_at: string | null;
}

interface TrademarkMonitoringDashboardProps {
  userId: string;
}

/** Pull the server's own error message (and status) out of a functions.invoke error. */
async function readInvokeError(error: unknown): Promise<{ message: string; status?: number }> {
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status;
    try {
      const body = await error.context.json();
      return { message: body?.error || error.message, status };
    } catch {
      return { message: error.message, status };
    }
  }
  return { message: (error as Error)?.message || 'Request failed' };
}

export default function TrademarkMonitoringDashboard({ userId }: TrademarkMonitoringDashboardProps) {
  const [monitors, setMonitors] = useState<TrademarkMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newMark, setNewMark] = useState('');
  const [adding, setAdding] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchMonitors = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trademark_monitoring')
        .select('id, mark_name, search_query, nice_classes, is_active, results_found, new_results_count, highest_similarity_score, last_search_at, next_search_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMonitors((data as unknown as TrademarkMonitor[]) || []);
      setLoadError(null);
    } catch (e: any) {
      console.error('Error fetching trademark monitors:', e);
      setLoadError(e?.message || 'Could not load your trademark watches.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchMonitors();
  }, [userId, fetchMonitors]);

  const handleInvokeError = async (title: string, error: unknown) => {
    const { message, status } = await readInvokeError(error);
    toast({
      title: status === 402 ? 'Trademark Suite required' : title,
      description: message,
      variant: 'destructive',
    });
    if (status === 402) navigate('/trademark-check');
  };

  const runMonitor = async (monitor: TrademarkMonitor) => {
    setRunningId(monitor.id);
    try {
      // The server loads the watch by id and checks it belongs to the caller
      const { data, error } = await supabase.functions.invoke('run-trademark-monitoring', {
        body: { monitorId: monitor.id },
      });
      if (error) { await handleInvokeError('Monitoring Failed', error); return; }
      const newConflicts = data?.newConflicts || 0;
      toast({
        title: newConflicts > 0 ? `${newConflicts} new possible conflict${newConflicts === 1 ? '' : 's'}` : 'Monitoring Complete',
        description: `Found ${data?.resultsFound || 0} results. ${data?.highestSimilarity ? `Highest similarity: ${(data.highestSimilarity * 100).toFixed(0)}%` : ''}`,
      });
      await fetchMonitors(false);
    } finally {
      setRunningId(null);
    }
  };

  const toggleActive = async (monitor: TrademarkMonitor) => {
    const nextActive = !monitor.is_active;
    const { error } = await supabase
      .from('trademark_monitoring')
      .update({ is_active: nextActive })
      .eq('id', monitor.id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    setMonitors(prev => prev.map(m => m.id === monitor.id ? { ...m, is_active: nextActive } : m));
  };

  const addMonitor = async () => {
    const mark = newMark.trim();
    if (!mark) return;
    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-trademark-monitoring', {
        body: { markName: mark, searchQuery: mark, niceClasses: [] },
      });
      if (error) { await handleInvokeError('Failed to create monitor', error); return; }
      toast({
        title: data?.created === false ? 'Already watching' : 'Monitor Created',
        description: data?.created === false
          ? `"${mark}" is already on your watch list.`
          : `Now watching "${mark}" — found ${data?.resultsFound || 0} existing results.`,
      });
      setNewMark('');
      setShowAdd(false);
      await fetchMonitors(false);
    } finally {
      setAdding(false);
    }
  };

  const deleteMonitor = async (id: string) => {
    const { error } = await supabase.from('trademark_monitoring').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    setMonitors(prev => prev.filter(m => m.id !== id));
    toast({ title: 'Monitor removed' });
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
            <Tag className="w-4 h-4 text-primary" />
            Trademark Watch
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {monitors.filter(m => m.is_active).length} active
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Add a trademark watch"
              onClick={() => setShowAdd(!showAdd)}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0 space-y-2">
        {showAdd && (
          <div className="flex gap-2 mb-2">
            <Input
              placeholder="Mark name to watch..."
              value={newMark}
              onChange={(e) => setNewMark(e.target.value)}
              className="text-base sm:text-xs h-9 sm:h-7"
              maxLength={120}
              onKeyDown={(e) => e.key === 'Enter' && !adding && addMonitor()}
            />
            <Button
              size="sm"
              className="h-9 sm:h-7 text-xs sm:text-[10px] px-3"
              disabled={adding || !newMark.trim()}
              onClick={addMonitor}
            >
              {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
            </Button>
          </div>
        )}

        {loadError ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => fetchMonitors()}>Retry</Button>
          </div>
        ) : monitors.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No trademark watches yet. Click + to monitor a mark name for conflicts.
          </p>
        ) : (
          monitors.map(monitor => (
            <div key={monitor.id} className="bg-muted/30 rounded-md p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium line-clamp-1 flex-1 min-w-0">{monitor.mark_name}</p>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Stop watching ${monitor.mark_name}`}
                    onClick={() => {
                      if (window.confirm(`Stop watching "${monitor.mark_name}"?`)) deleteMonitor(monitor.id);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <Switch
                    checked={monitor.is_active}
                    onCheckedChange={() => toggleActive(monitor)}
                    className="scale-75"
                  />
                </div>
              </div>
              <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {formatDateShort(monitor.last_search_at)}
                </span>
                <span>{monitor.results_found ?? 0} found</span>
                {monitor.is_active && monitor.next_search_at && (
                  <span>next {formatDateShort(monitor.next_search_at)}</span>
                )}
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
              <Button
                variant="outline"
                size="sm"
                className="w-full text-[10px] h-8 sm:h-6 gap-1"
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
