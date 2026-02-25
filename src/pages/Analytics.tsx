import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import {
  ArrowLeft, BarChart3, TrendingUp, FileText, Lightbulb,
  AlertTriangle, DollarSign, PieChart, ArrowUpRight, Activity
} from 'lucide-react';
import { usePatentData } from '@/hooks/usePatentData';
import { formatDollars, PATENT_VALUE_ESTIMATE } from '@/lib/pricingConstants';
import PriorArtMonitoringDashboard from '@/components/PriorArtMonitoringDashboard';
import { PageSEO } from '@/components/SEO';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartPie, Pie, Cell, AreaChart, Area
} from 'recharts';

const COLORS = ['hsl(var(--primary))', '#10b981', 'hsl(var(--accent))', '#f59e0b'];

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

  const statusData = [
    { name: 'Completed', value: stats.completedApplications, color: COLORS[0] },
    { name: 'In Progress', value: stats.inProgressApplications, color: COLORS[1] },
    { name: 'Ideas', value: stats.totalIdeas, color: COLORS[2] },
  ].filter(d => d.value > 0);

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

  const typeMap = new Map<string, number>();
  allSessions.forEach(s => {
    const type = s.patent_type || 'Unspecified';
    typeMap.set(type, (typeMap.get(type) || 0) + 1);
  });
  const typeData = Array.from(typeMap.entries()).map(([name, value]) => ({ name, value }));

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '12px',
    boxShadow: '0 8px 32px hsl(220 20% 10% / 0.1)',
    fontSize: 12,
    padding: '10px 14px',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/20 border-t-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageSEO.Dashboard />
      
      {/* Header */}
      <header className="border-b border-border bg-card/95 backdrop-blur-xl sticky top-0 z-50" style={{ boxShadow: 'var(--shadow-xs)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-3 sm:py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-3.5 h-3.5" />
                Dashboard
              </Button>
              <div className="w-px h-5 bg-border" />
              <div>
                <h1 className="text-lg font-semibold text-foreground tracking-tight">Portfolio Analytics</h1>
              </div>
            </div>
            <Badge variant="outline" className="text-xs gap-1.5 font-medium">
              <Activity className="w-3 h-3" />
              Live
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Applications', value: stats.totalApplications, icon: FileText, color: 'bg-primary/8', iconColor: 'text-primary' },
            { label: 'Portfolio Value', value: formatDollars(stats.portfolioValue), icon: DollarSign, color: 'bg-emerald-500/8', iconColor: 'text-emerald-600' },
            { label: 'Ideas Tracked', value: stats.totalIdeas, icon: Lightbulb, color: 'bg-amber-500/8', iconColor: 'text-amber-600' },
            { label: 'Active Alerts', value: stats.unreadAlerts, icon: AlertTriangle, color: 'bg-red-500/8', iconColor: 'text-red-500' },
          ].map((kpi, i) => (
            <div key={i} className="kpi-card">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${kpi.color} flex items-center justify-center`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <p className="kpi-value">{kpi.value}</p>
              <p className="kpi-label">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Filing Trend */}
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <h3><TrendingUp className="w-4 h-4 text-primary" />Filing Trend</h3>
                <p>Monthly patent application activity</p>
              </div>
            </div>
            <div className="chart-body">
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="filingGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="filings" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#filingGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"><TrendingUp /></div>
                  <h4>No filing data yet</h4>
                  <p>Start a patent application to see your filing trend.</p>
                </div>
              )}
            </div>
          </div>

          {/* Portfolio Composition */}
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <h3><PieChart className="w-4 h-4 text-emerald-600" />Portfolio Status</h3>
                <p>Current distribution by status</p>
              </div>
            </div>
            <div className="chart-body">
              {statusData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="55%" height={200}>
                    <RechartPie>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value" strokeWidth={0}>
                        {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </RechartPie>
                  </ResponsiveContainer>
                  <div className="space-y-3">
                    {statusData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{d.value}</p>
                          <p className="text-xs text-muted-foreground">{d.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"><PieChart /></div>
                  <h4>No data yet</h4>
                  <p>Complete an application to see your portfolio breakdown.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Technology Coverage */}
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <h3><BarChart3 className="w-4 h-4 text-accent" />Technology Coverage</h3>
                <p>Patent types in your portfolio</p>
              </div>
            </div>
            <div className="chart-body">
              {typeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={typeData} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"><BarChart3 /></div>
                  <h4>No technology data yet</h4>
                  <p>File patents across different types to see coverage.</p>
                </div>
              )}
            </div>
          </div>

          {/* Prior Art Monitoring */}
          {user && <PriorArtMonitoringDashboard userId={user.id} />}
        </div>

        {/* Portfolio Value Breakdown */}
        <div className="chart-card mb-6">
          <div className="chart-header">
            <div>
              <h3><DollarSign className="w-4 h-4 text-emerald-600" />Portfolio Value Breakdown</h3>
              <p>Estimated value by application</p>
            </div>
            <Badge variant="outline" className="text-xs">{completedSessions.length} patents</Badge>
          </div>
          <div>
            {completedSessions.length > 0 ? (
              completedSessions.slice(0, 5).map((s, i) => (
                <div key={s.id} className="data-table-row">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.idea_prompt}</p>
                      <p className="text-xs text-muted-foreground">{s.patent_type || 'Patent'}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">{formatDollars(PATENT_VALUE_ESTIMATE)}</span>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-icon"><DollarSign /></div>
                <h4>No completed patents</h4>
                <p>Complete patent applications to build portfolio value.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Analytics;
