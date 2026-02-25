import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Users, DollarSign, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface AnalyticsData {
  dailyMetrics: {
    date: string;
    visitors: number;
    signups: number;
    conversions: number;
    revenue: number;
  }[];
  funnelData: {
    name: string;
    value: number;
    fill: string;
  }[];
  userStages: {
    stage: string;
    count: number;
    percentage: number;
  }[];
  conversionRate: number;
  visitorTrend: number;
  revenueTrend: number;
}

interface AdminAnalyticsChartsProps {
  data: AnalyticsData;
}

const COLORS = ['hsl(var(--primary))', '#10b981', 'hsl(var(--accent))', '#f59e0b', '#ef4444', '#8b5cf6'];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
  boxShadow: '0 8px 32px hsl(220 20% 10% / 0.1)',
  fontSize: 12,
  padding: '10px 14px',
};

export const AdminAnalyticsCharts: React.FC<AdminAnalyticsChartsProps> = ({ data }) => {
  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Signups (7d)',
            value: data.dailyMetrics.reduce((s, d) => s + d.signups, 0).toLocaleString(),
            icon: Users,
            trend: data.visitorTrend,
            color: 'bg-primary/8',
            iconColor: 'text-primary',
          },
          {
            label: 'Applications (7d)',
            value: data.funnelData.find(f => f.name === 'Started Application')?.value.toLocaleString() || '0',
            icon: Activity,
            color: 'bg-indigo-500/8',
            iconColor: 'text-indigo-600',
          },
          {
            label: 'Conversions (7d)',
            value: data.dailyMetrics.reduce((s, d) => s + d.conversions, 0).toLocaleString(),
            icon: TrendingUp,
            subtitle: `${data.conversionRate.toFixed(1)}% rate`,
            color: 'bg-emerald-500/8',
            iconColor: 'text-emerald-600',
          },
          {
            label: 'Revenue (7d)',
            value: `$${(data.dailyMetrics.reduce((s, d) => s + d.revenue, 0) / 100).toLocaleString()}`,
            icon: DollarSign,
            trend: data.revenueTrend,
            color: 'bg-amber-500/8',
            iconColor: 'text-amber-600',
          },
        ].map((kpi, i) => (
          <div key={i} className="kpi-card">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${kpi.color} flex items-center justify-center`}>
                <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
              </div>
              {kpi.trend !== undefined && (
                <span className={`kpi-trend ${kpi.trend >= 0 ? 'up' : 'down'}`}>
                  {kpi.trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(kpi.trend)}%
                </span>
              )}
            </div>
            <p className="kpi-value">{kpi.value}</p>
            <p className="kpi-label">{kpi.label}</p>
            {kpi.subtitle && <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>}
          </div>
        ))}
      </div>

      {/* Signups & Conversions Chart */}
      <div className="chart-card">
        <div className="chart-header">
          <div>
            <h3><Users className="w-4 h-4 text-primary" />Signups & Conversions</h3>
            <p>Daily user signups and payment conversions</p>
          </div>
        </div>
        <div className="chart-body">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.dailyMetrics}>
              <defs>
                <linearGradient id="gradSignups" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradConversions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area type="monotone" dataKey="signups" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gradSignups)" name="Signups" />
              <Area type="monotone" dataKey="conversions" stroke="#10b981" strokeWidth={2} fill="url(#gradConversions)" name="Conversions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue & Funnel */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3><DollarSign className="w-4 h-4 text-emerald-600" />Revenue Trend</h3>
              <p>Daily revenue (PatentBot AI)</p>
            </div>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.dailyMetrics} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`$${(value / 100).toFixed(2)}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funnel */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3><TrendingUp className="w-4 h-4 text-primary" />Conversion Funnel</h3>
              <p>User journey stages</p>
            </div>
          </div>
          <div className="chart-body space-y-3">
            {data.funnelData.map((stage, idx) => {
              const pct = data.funnelData[0].value > 0 ? (stage.value / data.funnelData[0].value) * 100 : 0;
              const dropoff = idx > 0 && data.funnelData[idx - 1].value > 0
                ? ((stage.value / data.funnelData[idx - 1].value) * 100).toFixed(1)
                : null;
              return (
                <div key={stage.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">{stage.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{stage.value.toLocaleString()}</span>
                      {dropoff && (
                        <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0">
                          {dropoff}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${pct}%`, background: COLORS[idx % COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* User Stages */}
      <div className="chart-card">
        <div className="chart-header">
          <div>
            <h3><Users className="w-4 h-4 text-primary" />User Stages</h3>
            <p>Current distribution of users by status</p>
          </div>
        </div>
        <div className="chart-body">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {data.userStages.map((stage, idx) => (
              <div key={stage.stage} className="text-center p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-2xl font-bold tracking-tight" style={{ color: COLORS[idx % COLORS.length] }}>
                  {stage.count.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-medium">{stage.stage}</p>
                <Badge variant="outline" className="mt-2 text-[10px]">
                  {stage.percentage.toFixed(1)}%
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsCharts;
