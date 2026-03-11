import React, { useState, useEffect } from 'react';
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

export default function TrademarkMonitoringDashboard({ userId }: TrademarkMonitoringDashboardProps) {
  const [monitors, setMonitors] = useState<TrademarkMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newMark, setNewMark] = useState('');
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const fetchMonitors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trademark_monitoring')
        .select('*')
        .eq('user_id', userId)
        .order('last_search_at', { ascending: false });
      if (error) throw error;
      setMonitors((data as TrademarkMonitor[]) || []);
    } catch (e: any) {
      console.error('Error fetching trademark monitors:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchMonitors();
  }, [userId]);

  const runMonitor = async (monitor: TrademarkMonitor) => {
    setRunningId(monitor.id);
    try {
      const { data, error } = await supabase.functions.invoke('run-trademark-monitoring', {
        body: {
          monitorId: monitor.id,
          markName: monitor.mark_name,
          searchQuery: monitor.search_query,
          niceClasses: monitor.nice_classes,
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

  const toggleActive = async (monitor: TrademarkMonitor) => {
    try {
      await supabase
        .from('trademark_monitoring')
        .update({ is_active: !monitor.is_active })
        .eq('id', monitor.id);
      setMonitors(prev => prev.map(m => m.id === monitor.id ? { ...m, is_active: !m.is_active } : m));
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    }
  };

  const addMonitor = async () => {
    if (!newMark.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-trademark-monitoring', {
        body: {
          markName: newMark.trim(),
          searchQuery: newMark.trim(),
          niceClasses: [],
          userId,
        }
      });
      if (error) throw error;
      toast({
        title: 'Monitor Created',
        description: `Now watching "${newMark.trim()}" — found ${data.resultsFound || 0} existing results.`,
      });
      setNewMark('');
      setShowAdd(false);
      await fetchMonitors();
    } catch (e: any) {
      toast({ title: 'Failed to create monitor', description: e.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const deleteMonitor = async (id: string) => {
    try {
      await supabase.from('trademark_monitoring').delete().eq('id', id);
      setMonitors(prev => prev.filter(m => m.id !== id));
      toast({ title: 'Monitor removed' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
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
              className="h-6 w-6 p-0"
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
              className="text-xs h-7"
              onKeyDown={(e) => e.key === 'Enter' && addMonitor()}
            />
            <Button
              size="sm"
              className="h-7 text-[10px] px-3"
              disabled={adding || !newMark.trim()}
              onClick={addMonitor}
            >
              {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
            </Button>
          </div>
        )}

        {monitors.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No trademark watches yet. Click + to monitor a mark name for conflicts.
          </p>
        ) : (
          monitors.map(monitor => (
            <div key={monitor.id} className="bg-muted/30 rounded-md p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium line-clamp-1 flex-1">{monitor.mark_name}</p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMonitor(monitor.id)}
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                  <Switch
                    checked={monitor.is_active}
                    onCheckedChange={() => toggleActive(monitor)}
                    className="scale-75"
                  />
                </div>
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
