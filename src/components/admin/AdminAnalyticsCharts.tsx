import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, FunnelChart, Funnel, LabelList } from 'recharts';
import { TrendingUp, Users, Eye, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';

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

export const AdminAnalyticsCharts: React.FC<AdminAnalyticsChartsProps> = ({ data }) => {
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Visitors (7d)</p>
                <p className="text-2xl font-bold mt-1">
                  {data.dailyMetrics.reduce((sum, d) => sum + d.visitors, 0).toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-primary/10 rounded-full">
                <Eye className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className={`flex items-center gap-1 text-xs mt-2 ${data.visitorTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.visitorTrend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(data.visitorTrend)}% vs last week
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-secondary/5 to-secondary/10 border-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Signups (7d)</p>
                <p className="text-2xl font-bold mt-1">
                  {data.dailyMetrics.reduce((sum, d) => sum + d.signups, 0).toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-secondary/10 rounded-full">
                <Users className="h-5 w-5 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/5 to-emerald-500/10 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Conversions (7d)</p>
                <p className="text-2xl font-bold mt-1">
                  {data.dailyMetrics.reduce((sum, d) => sum + d.conversions, 0).toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-green-500/10 rounded-full">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs mt-2 text-muted-foreground">
              {data.conversionRate.toFixed(1)}% conversion rate
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/5 to-amber-500/10 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Revenue (7d)</p>
                <p className="text-2xl font-bold mt-1">
                  ${(data.dailyMetrics.reduce((sum, d) => sum + d.revenue, 0) / 100).toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-yellow-500/10 rounded-full">
                <DollarSign className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
            <div className={`flex items-center gap-1 text-xs mt-2 ${data.revenueTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.revenueTrend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(data.revenueTrend)}% vs last week
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visitors & Conversions Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Visitors, Signups & Conversions
          </CardTitle>
          <CardDescription>Daily traffic and conversion trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.dailyMetrics}>
                <defs>
                  <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="visitors" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorVisitors)" name="Visitors" />
                <Area type="monotone" dataKey="signups" stroke="hsl(var(--secondary))" fillOpacity={1} fill="url(#colorSignups)" name="Signups" />
                <Area type="monotone" dataKey="conversions" stroke="#10b981" fillOpacity={1} fill="url(#colorConversions)" name="Conversions" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Chart & User Funnel */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Revenue Trend
            </CardTitle>
            <CardDescription>Daily revenue from PatentBot AI only</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dailyMetrics}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `$${(v/100).toFixed(0)}`} />
                  <Tooltip 
                    formatter={(value: number) => [`$${(value/100).toFixed(2)}`, 'Revenue']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* User Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Conversion Funnel
            </CardTitle>
            <CardDescription>User journey stages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.funnelData.map((stage, idx) => (
                <div key={stage.name} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{stage.name}</span>
                    <span className="text-sm text-muted-foreground">{stage.value.toLocaleString()}</span>
                  </div>
                  <div className="h-8 bg-muted rounded-lg overflow-hidden">
                    <div 
                      className="h-full rounded-lg transition-all duration-500"
                      style={{ 
                        width: `${(stage.value / data.funnelData[0].value) * 100}%`,
                        backgroundColor: COLORS[idx % COLORS.length]
                      }}
                    />
                  </div>
                  {idx > 0 && (
                    <div className="absolute -top-1 right-0 text-xs text-muted-foreground">
                      {((stage.value / data.funnelData[idx - 1].value) * 100).toFixed(1)}% ↓
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Stages Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-secondary" />
            User Stages
          </CardTitle>
          <CardDescription>Current distribution of users by status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {data.userStages.map((stage, idx) => (
              <div key={stage.stage} className="text-center p-4 bg-muted/50 rounded-xl">
                <div className="text-2xl font-bold" style={{ color: COLORS[idx % COLORS.length] }}>
                  {stage.count.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{stage.stage}</div>
                <Badge variant="outline" className="mt-2 text-xs">
                  {stage.percentage.toFixed(1)}%
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalyticsCharts;
