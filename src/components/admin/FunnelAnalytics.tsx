import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, TrendingDown, Users, MousePointer, CreditCard } from 'lucide-react';
import { FUNNEL_STEPS } from '@/hooks/useFunnelTracking';

interface FunnelData {
  step: string;
  count: number;
  percentage: number;
  dropoff: number;
}

interface FunnelEvent {
  id: string;
  session_id: string;
  user_id: string | null;
  event_type: string;
  funnel_step: string;
  page_path: string;
  created_at: string;
  metadata: Record<string, any>;
}

export function FunnelAnalytics() {
  const [timeRange, setTimeRange] = useState('24h');
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [recentEvents, setRecentEvents] = useState<FunnelEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [uniqueSessions, setUniqueSessions] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;
      switch (timeRange) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const { data: events, error } = await supabase
        .from('funnel_events')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const sessions = new Set((events || []).map(e => e.session_id));
      setUniqueSessions(sessions.size);

      const stepOrder = [
        FUNNEL_STEPS.LANDING,
        FUNNEL_STEPS.AUTH_VIEW,
        FUNNEL_STEPS.AUTH_SIGNUP_COMPLETE,
        FUNNEL_STEPS.DASHBOARD,
        FUNNEL_STEPS.NEW_APPLICATION_START,
        FUNNEL_STEPS.PATENT_SESSION_CREATED,
        FUNNEL_STEPS.PAYMENT_COMPLETE,
      ];

      const stepCounts: Record<string, Set<string>> = {};
      stepOrder.forEach(step => {
        stepCounts[step] = new Set();
      });

      (events || []).forEach(event => {
        if (stepCounts[event.funnel_step]) {
          stepCounts[event.funnel_step].add(event.session_id);
        }
      });

      const topCount = stepCounts[stepOrder[0]]?.size || 1;
      const funnel: FunnelData[] = stepOrder.map((step, index) => {
        const count = stepCounts[step]?.size || 0;
        const prevCount = index > 0 ? (stepCounts[stepOrder[index - 1]]?.size || 0) : count;
        const dropoff = prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 100) : 0;
        
        return {
          step,
          count,
          percentage: Math.round((count / topCount) * 100),
          dropoff: index === 0 ? 0 : dropoff,
        };
      });

      setFunnelData(funnel);
      setRecentEvents((events || []).slice(0, 10) as FunnelEvent[]);
    } catch (error) {
      console.error('Error fetching funnel data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const getStepLabel = (step: string) => {
    const labels: Record<string, { icon: string; label: string }> = {
      landing: { icon: '🏠', label: 'Landing' },
      auth_view: { icon: '🔐', label: 'Auth Page' },
      auth_signup_start: { icon: '✏️', label: 'Signup Start' },
      auth_signup_complete: { icon: '✅', label: 'Signup Done' },
      auth_login: { icon: '🔑', label: 'Login' },
      dashboard: { icon: '📊', label: 'Dashboard' },
      new_application_start: { icon: '📝', label: 'New App' },
      patent_session_created: { icon: '💡', label: 'Patent Session' },
      payment_initiated: { icon: '💳', label: 'Payment Start' },
      payment_complete: { icon: '💰', label: 'Payment Done' },
      check_page_view: { icon: '🔍', label: 'Check & See' },
      prior_art_search: { icon: '🔎', label: 'Prior Art' },
    };
    return labels[step] || { icon: '•', label: step };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Funnel</h3>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1h</SelectItem>
              <SelectItem value="24h">24h</SelectItem>
              <SelectItem value="7d">7d</SelectItem>
              <SelectItem value="30d">30d</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary - Compact 4-column grid */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Users, label: 'Sessions', value: uniqueSessions },
          { icon: MousePointer, label: 'Signups', value: funnelData.find(f => f.step === 'auth_signup_complete')?.count || 0 },
          { icon: TrendingDown, label: 'Drop', value: `${funnelData.find(f => f.step === 'auth_signup_complete')?.dropoff || 0}%` },
          { icon: CreditCard, label: 'Paid', value: funnelData.find(f => f.step === 'payment_complete')?.count || 0 },
        ].map((stat) => (
          <Card key={stat.label} className="p-2">
            <div className="flex items-center gap-1.5">
              <stat.icon className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-[10px] text-muted-foreground truncate">{stat.label}</span>
            </div>
            <p className="text-lg font-bold mt-0.5">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Funnel Steps - Compact */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm">Steps</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="space-y-2">
            {funnelData.map((step) => {
              const stepInfo = getStepLabel(step.step);
              return (
                <div key={step.step} className="flex items-center gap-2">
                  <span className="text-sm shrink-0">{stepInfo.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="font-medium truncate">{stepInfo.label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-muted-foreground">{step.count}</span>
                        {step.dropoff > 0 && (
                          <span className={`text-[10px] ${step.dropoff >= 50 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            -{step.dropoff}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${step.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Events - Compact scrollable list */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm">Recent</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {recentEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No events yet</p>
            ) : (
              recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span>{getStepLabel(event.funnel_step).icon}</span>
                    <span className="text-muted-foreground truncate">{event.page_path}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
