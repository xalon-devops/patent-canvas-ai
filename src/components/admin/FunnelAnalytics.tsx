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
      // Calculate time filter
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

      // Fetch all events in time range
      const { data: events, error } = await supabase
        .from('funnel_events')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate unique sessions
      const sessions = new Set((events || []).map(e => e.session_id));
      setUniqueSessions(sessions.size);

      // Calculate funnel metrics
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
      setRecentEvents((events || []).slice(0, 20) as FunnelEvent[]);
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
    const labels: Record<string, string> = {
      landing: '🏠 Landing Page',
      auth_view: '🔐 Auth Page View',
      auth_signup_start: '✏️ Signup Started',
      auth_signup_complete: '✅ Signup Complete',
      auth_login: '🔑 Login',
      dashboard: '📊 Dashboard',
      new_application_start: '📝 New App Started',
      patent_session_created: '💡 Patent Session',
      payment_initiated: '💳 Payment Started',
      payment_complete: '💰 Payment Complete',
      check_page_view: '🔍 Check & See',
      prior_art_search: '🔎 Prior Art Search',
    };
    return labels[step] || step;
  };

  const getDropoffColor = (dropoff: number) => {
    if (dropoff === 0) return 'text-muted-foreground';
    if (dropoff < 30) return 'text-green-600';
    if (dropoff < 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Conversion Funnel</h3>
          <p className="text-sm text-muted-foreground">Track where visitors drop off</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Sessions</span>
            </div>
            <p className="text-2xl font-bold">{uniqueSessions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MousePointer className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Signups</span>
            </div>
            <p className="text-2xl font-bold">
              {funnelData.find(f => f.step === 'auth_signup_complete')?.count || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Auth Dropoff</span>
            </div>
            <p className="text-2xl font-bold">
              {funnelData.find(f => f.step === 'auth_signup_complete')?.dropoff || 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Payments</span>
            </div>
            <p className="text-2xl font-bold">
              {funnelData.find(f => f.step === 'payment_complete')?.count || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funnel Steps</CardTitle>
          <CardDescription>Conversion rate at each step</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {funnelData.map((step, index) => (
              <div key={step.step} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{getStepLabel(step.step)}</span>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{step.count} sessions</Badge>
                    {step.dropoff > 0 && (
                      <span className={`text-xs font-medium ${getDropoffColor(step.dropoff)}`}>
                        ↓ {step.dropoff}% dropoff
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-8 bg-muted rounded-md overflow-hidden">
                  <div
                    className="h-full bg-primary/80 transition-all duration-500"
                    style={{ width: `${step.percentage}%` }}
                  />
                </div>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-primary-foreground mix-blend-difference">
                  {step.percentage}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Events</CardTitle>
          <CardDescription>Last 20 funnel events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No events recorded yet. Visit the landing page to start tracking.
              </p>
            ) : (
              recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {event.funnel_step}
                    </Badge>
                    <span className="text-muted-foreground">{event.page_path}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {event.user_id && (
                      <Badge variant="secondary" className="text-xs">
                        Logged In
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
