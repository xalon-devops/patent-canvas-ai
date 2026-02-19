import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import {
  ArrowLeft, BarChart3, TrendingUp, Shield, FileText, Lightbulb,
  AlertTriangle, Clock, DollarSign, PieChart
} from 'lucide-react';
import { usePatentData } from '@/hooks/usePatentData';
import { formatDollars, PATENT_VALUE_ESTIMATE } from '@/lib/pricingConstants';
import PriorArtMonitoringDashboard from '@/components/PriorArtMonitoringDashboard';
import { PageSEO } from '@/components/SEO';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartPie, Pie, Cell, AreaChart, Area
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const Analytics = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate('/auth'); return; }
      setUser(session.user);
    };
    checkAuth();
  }, [navigate]);

  const { stats, pendingSessions, completedSessions, ideas, loading } = usePatentData(user?.id);

  // Build chart data from real sessions
  const statusData = [
    { name: 'Completed', value: stats.completedApplications, color: COLORS[0] },
    { name: 'In Progress', value: stats.inProgressApplications, color: COLORS[1] },
    { name: 'Ideas', value: stats.totalIdeas, color: COLORS[2] },
  ].filter(d => d.value > 0);

  // Monthly filing trend (group sessions by month)
  const allSessions = [...pendingSessions, ...completedSessions];
  const monthlyMap = new Map<string, number>();
  allSessions.forEach(s => {
    const d = new Date(s.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
  });
  const monthlyData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, count]) => ({ month, filings: count }));

  // Technology coverage from patent types
  const typeMap = new Map<string, number>();
  allSessions.forEach(s => {
    const type = s.patent_type || 'Unspecified';
    typeMap.set(type, (typeMap.get(type) || 0) + 1);
  });
  const typeData = Array.from(typeMap.entries()).map(([name, value]) => ({ name, value }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-3 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PageSEO.Dashboard />
      <div className="safe-area py-4 sm:py-6">
        <div className="content-width px-3 sm:px-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="gap-1.5 self-start text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />Dashboard
            </Button>
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-1">
                Portfolio Analytics
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Comprehensive IP portfolio intelligence & monitoring
              </p>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card className="bg-card/90 border-white/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg"><FileText className="w-4 h-4 text-primary" /></div>
                  <div>
                    <p className="text-lg font-bold">{stats.totalApplications}</p>
                    <p className="text-[10px] text-muted-foreground">Total Apps</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/90 border-white/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-secondary/10 rounded-lg"><DollarSign className="w-4 h-4 text-secondary" /></div>
                  <div>
                    <p className="text-lg font-bold">{formatDollars(stats.portfolioValue)}</p>
                    <p className="text-[10px] text-muted-foreground">Portfolio Value</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/90 border-white/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-accent/10 rounded-lg"><Lightbulb className="w-4 h-4 text-accent" /></div>
                  <div>
                    <p className="text-lg font-bold">{stats.totalIdeas}</p>
                    <p className="text-[10px] text-muted-foreground">Ideas Tracked</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/90 border-white/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-destructive/10 rounded-lg"><AlertTriangle className="w-4 h-4 text-destructive" /></div>
                  <div>
                    <p className="text-lg font-bold">{stats.unreadAlerts}</p>
                    <p className="text-[10px] text-muted-foreground">Active Alerts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Filing Trend */}
            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Filing Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="filings" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">No filing data yet</p>
                )}
              </CardContent>
            </Card>

            {/* Portfolio Composition */}
            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-secondary" />
                  Portfolio Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {statusData.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={160}>
                      <RechartPie>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={4} dataKey="value">
                          {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 11 }} />
                      </RechartPie>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {statusData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-xs">{d.name}: <strong>{d.value}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Technology Coverage */}
            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-accent" />
                  Technology Coverage
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {typeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={typeData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Bar dataKey="value" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">No technology data yet</p>
                )}
              </CardContent>
            </Card>

            {/* Prior Art Monitoring */}
            {user && <PriorArtMonitoringDashboard userId={user.id} />}
          </div>

          {/* Portfolio Value Breakdown */}
          <Card className="mb-6">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-secondary" />
                Portfolio Value Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-2">
                {completedSessions.slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-muted/30 rounded-md p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium line-clamp-1">{s.idea_prompt}</p>
                      <p className="text-[10px] text-muted-foreground">{s.patent_type || 'Patent'}</p>
                    </div>
                    <span className="text-xs font-bold text-secondary">{formatDollars(PATENT_VALUE_ESTIMATE)}</span>
                  </div>
                ))}
                {completedSessions.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Complete patent applications to build portfolio value</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
