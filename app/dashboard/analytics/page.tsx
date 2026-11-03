'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Clock, FileText, ShieldAlert, Activity } from 'lucide-react';
import { useAuth } from '@/components/providers';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function AnalyticsPage() {
  const { session } = useAuth();
  const [daily, setDaily] = useState<{ date: string; count: number }[]>([]);
  const [byType, setByType] = useState<{ name: string; value: number }[]>([]);
  const [byStatus, setByStatus] = useState<{ name: string; value: number }[]>([]);
  const [totals, setTotals] = useState({ analyses: 0, findings: 0, protected: 0, processingMs: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!session) return;
      const { data: analyses } = await supabase.from('analyses').select('*').eq('user_id', session.user.id);
      const { data: detections } = await supabase.from('detections').select('id, created_at', { count: 'exact', head: false }).eq('user_id', session.user.id);
      const rows = analyses ?? [];
      // Last 14 days
      const days: { date: string; count: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
        const next = new Date(d); next.setDate(next.getDate() + 1);
        const count = rows.filter((r) => { const c = new Date(r.created_at); return c >= d && c < next; }).length;
        days.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count });
      }
      setDaily(days);
      // By type
      const typeMap = new Map<string, number>();
      rows.forEach((r) => typeMap.set(r.source_kind, (typeMap.get(r.source_kind) ?? 0) + 1));
      setByType(Array.from(typeMap.entries()).map(([name, value]) => ({ name, value })));
      // By status
      const stMap = new Map<string, number>();
      rows.forEach((r) => stMap.set(r.status, (stMap.get(r.status) ?? 0) + 1));
      setByStatus(Array.from(stMap.entries()).map(([name, value]) => ({ name, value })));
      setTotals({
        analyses: rows.length,
        findings: detections?.length ?? 0,
        protected: rows.filter((r) => r.status === 'protected').length,
        processingMs: rows.reduce((s, r) => s + (r.processing_ms ?? 0), 0),
      });
      setLoading(false);
    })();
  }, [session]);

  const cards = [
    { label: 'Total analyses', value: totals.analyses, icon: FileText },
    { label: 'Total findings', value: totals.findings, icon: ShieldAlert },
    { label: 'Protected files', value: totals.protected, icon: Activity },
    { label: 'Processing time', value: `${(totals.processingMs / 1000).toFixed(1)}s`, icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Usage Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">How you use PRIVASEC AI over time.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="border-border/60">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                <p className="mt-1 font-display text-2xl font-bold text-foreground">{loading ? '—' : c.value}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 text-primary"><c.icon className="h-5 w-5" /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-lg">Daily analyses (14 days)</CardTitle><CardDescription>Analysis count per day.</CardDescription></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={daily} margin={{ left: -20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">By content type</CardTitle><CardDescription>Distribution across formats.</CardDescription></CardHeader>
          <CardContent>
            {byType.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p> : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">By status</CardTitle><CardDescription>How much is protected.</CardDescription></CardHeader>
          <CardContent>
            {byStatus.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p> : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}