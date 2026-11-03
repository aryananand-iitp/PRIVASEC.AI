'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ScanLine, ShieldAlert, ShieldCheck, Clock, ArrowRight, FileText,
  BarChart3, Sparkles, Info, AlertTriangle, TrendingUp, Plus,
} from 'lucide-react';
import { useAuth, useLang } from '@/components/providers';
import { useDashboardStats } from '@/hooks/use-dashboard-stats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { riskBand } from '@/lib/pii-engine';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const PIE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--warning))'];

export default function OverviewPage() {
  const { session } = useAuth();
  const { t } = useLang();
  const { stats, reload } = useDashboardStats();
  const [hidden, setHidden] = useState<string[]>([]);
  const [now] = useState(new Date());

  useEffect(() => {
    (async () => {
      if (!session) return;
      const { data } = await supabase.from('preferences').select('hidden_widgets').eq('user_id', session.user.id).maybeSingle();
      if (data?.hidden_widgets) setHidden(data.hidden_widgets);
    })();
  }, [session]);

  const firstName = (session?.user.user_metadata?.full_name as string | undefined)?.split(' ')[0] || session?.user.email?.split('@')[0] || 'there';

  function toggleWidget(id: string) {
    setHidden((h) => {
      const next = h.includes(id) ? h.filter((x) => x !== id) : [...h, id];
      if (session) supabase.from('preferences').update({ hidden_widgets: next }).eq('user_id', session.user.id);
      return next;
    });
  }

  const isHidden = (id: string) => hidden.includes(id);

  const cards = [
    { id: 'total', label: 'Total Files Analyzed', value: stats.totalAnalyses, icon: FileText, color: 'text-primary' },
    { id: 'findings', label: 'Total Privacy Findings', value: stats.totalFindings, icon: ShieldAlert, color: 'text-warning' },
    { id: 'protected', label: 'Protected Files', value: stats.protectedFiles, icon: ShieldCheck, color: 'text-success' },
    { id: 'highrisk', label: 'High-Risk Findings', value: stats.highRiskFindings, icon: AlertTriangle, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {t('common.welcome')}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/analyze">
            <Plus className="mr-2 h-4 w-4" /> {t('common.quickAnalysis')}
          </Link>
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.id} className="border-border/60 transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                <p className="mt-1 font-display text-3xl font-bold text-foreground">
                  {stats.loading ? '—' : c.value.toLocaleString()}
                </p>
              </div>
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl bg-muted/50', c.color)}>
                <c.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* A. Quick Analysis Center */}
      {!isHidden('quick') && (
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Quick Analysis Center</CardTitle>
              <CardDescription>Start a new privacy analysis in seconds.</CardDescription>
            </div>
            <WidgetToggle id="quick" hidden={isHidden('quick')} onToggle={toggleWidget} />
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Link href="/dashboard/analyze?kind=text" className="group rounded-lg border border-border/60 p-4 transition-colors hover:border-accent hover:bg-accent/5">
                <ScanLine className="h-6 w-6 text-primary" />
                <p className="mt-2 font-medium text-foreground">Text</p>
                <p className="text-xs text-muted-foreground">Paste or upload text to scan for PII.</p>
              </Link>
              <Link href="/dashboard/analyze?kind=image" className="group rounded-lg border border-border/60 p-4 transition-colors hover:border-accent hover:bg-accent/5">
                <FileText className="h-6 w-6 text-primary" />
                <p className="mt-2 font-medium text-foreground">Image / PDF / Subtitle</p>
                <p className="text-xs text-muted-foreground">Upload files for detection (text-extractable formats).</p>
              </Link>
              <Link href="/dashboard/analyze?kind=video" className="group rounded-lg border border-border/60 p-4 transition-colors hover:border-accent hover:bg-accent/5">
                <Sparkles className="h-6 w-6 text-primary" />
                <p className="mt-2 font-medium text-foreground">Video / Audio</p>
                <p className="text-xs text-muted-foreground">Transcript-based analysis where supported.</p>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* B. Overall Privacy Risk Overview */}
        {!isHidden('risk') && (
          <Card className="border-border/60 lg:col-span-1">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">Overall Privacy Risk</CardTitle>
                <CardDescription>Aggregated across all your analyses.</CardDescription>
              </div>
              <WidgetToggle id="risk" hidden={isHidden('risk')} onToggle={toggleWidget} />
            </CardHeader>
            <CardContent>
              <RiskGauge score={stats.recent.length ? Math.max(...stats.recent.map((r) => r.risk_score ?? 0)) : 0} />
            </CardContent>
          </Card>
        )}

        {/* C. Recent Analysis */}
        {!isHidden('recent') && (
          <Card className="border-border/60 lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">Recent Analysis</CardTitle>
                <CardDescription>Your latest privacy scans.</CardDescription>
              </div>
              <WidgetToggle id="recent" hidden={isHidden('recent')} onToggle={toggleWidget} />
            </CardHeader>
            <CardContent>
              {stats.loading ? (
                <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
              ) : stats.recent.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-2">
                  {stats.recent.map((r) => (
                    <Link
                      key={r.id}
                      href={`/dashboard/threats?id=${r.id}`}
                      className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2.5 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {r.original_filename || `${r.source_kind} analysis`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.detection_count} findings · {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.risk_score != null && <RiskBadge score={r.risk_score} />}
                        <StatusBadge status={r.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* D. Threat Distribution + E. Protection Statistics */}
      <div className="grid gap-6 lg:grid-cols-2">
        {!isHidden('threat') && (
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">Threat Distribution</CardTitle>
                <CardDescription>Findings by detection category.</CardDescription>
              </div>
              <WidgetToggle id="threat" hidden={isHidden('threat')} onToggle={toggleWidget} />
            </CardHeader>
            <CardContent>
              {stats.threatDistribution.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.threatDistribution} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={110} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}

        {!isHidden('protection') && (
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">Protection Statistics</CardTitle>
                <CardDescription>How much of your content is protected.</CardDescription>
              </div>
              <WidgetToggle id="protection" hidden={isHidden('protection')} onToggle={toggleWidget} />
            </CardHeader>
            <CardContent className="space-y-4">
              <StatRow label="Analyzed" value={stats.totalAnalyses} total={stats.totalAnalyses || 1} color="hsl(var(--chart-1))" />
              <StatRow label="Protected" value={stats.protectedFiles} total={stats.totalAnalyses || 1} color="hsl(var(--success))" />
              <StatRow label="Open high-risk" value={stats.highRiskFindings} total={stats.totalFindings || 1} color="hsl(var(--destructive))" />
              <div className="flex items-center gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                <span>Protection status reflects analyses where redaction was applied and verified.</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* F. Weekly Usage Analytics */}
      {!isHidden('weekly') && (
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Weekly Usage Analytics</CardTitle>
              <CardDescription>Analyses and findings over the past 7 days.</CardDescription>
            </div>
            <WidgetToggle id="weekly" hidden={isHidden('weekly')} onToggle={toggleWidget} />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={stats.weekly} margin={{ left: -20, right: 10, top: 5 }}>
                <defs>
                  <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="analyses" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#aGrad)" />
                <Area type="monotone" dataKey="findings" stroke="hsl(var(--warning))" strokeWidth={2} fill="url(#fGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* G. Recommended Security Actions + H. Learning suggestions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {!isHidden('recommend') && (
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">Recommended Security Actions</CardTitle>
                <CardDescription>Non-alarming suggestions based on your activity.</CardDescription>
              </div>
              <WidgetToggle id="recommend" hidden={isHidden('recommend')} onToggle={toggleWidget} />
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.highRiskFindings > 0 ? (
                <Recommendation
                  icon={AlertTriangle}
                  color="text-destructive"
                  title={`${stats.highRiskFindings} high-risk findings need attention`}
                  body="Review and protect these findings before sharing the related content."
                  action={<Button asChild size="sm" variant="outline"><Link href="/dashboard/protection">Open Protection Center <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>}
                />
              ) : null}
              {stats.totalAnalyses > 0 && stats.protectedFiles < stats.totalAnalyses ? (
                <Recommendation
                  icon={ShieldCheck}
                  color="text-accent"
                  title="Protect unprotected analyses"
                  body={`${stats.totalAnalyses - stats.protectedFiles} analyses have not been protected yet.`}
                  action={<Button asChild size="sm" variant="outline"><Link href="/dashboard/history">Review history <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>}
                />
              ) : null}
              {stats.totalAnalyses === 0 ? (
                <Recommendation
                  icon={TrendingUp}
                  color="text-primary"
                  title="Run your first analysis"
                  body="Paste a sample of text to see how PRIVASEC AI detects personal information."
                  action={<Button asChild size="sm"><Link href="/dashboard/analyze">Start now <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>}
                />
              ) : null}
              <Recommendation
                icon={BarChart3}
                color="text-secondary"
                title="Review your usage trends"
                body="See how your privacy activity changes week to week."
                action={<Button asChild size="sm" variant="outline"><Link href="/dashboard/analytics">View analytics <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>}
              />
            </CardContent>
          </Card>
        )}

        {!isHidden('learn') && (
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">Learning & Help</CardTitle>
                <CardDescription>Understand privacy risks and how protection works.</CardDescription>
              </div>
              <WidgetToggle id="learn" hidden={isHidden('learn')} onToggle={toggleWidget} />
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { title: 'Getting Started', href: '/dashboard/learn' },
                { title: 'Understanding Privacy Risks', href: '/dashboard/learn' },
                { title: 'How Automatic Redaction Works', href: '/dashboard/learn' },
                { title: 'Frequently Asked Questions', href: '/dashboard/learn' },
              ].map((l) => (
                <Link key={l.title} href={l.href} className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-muted/40">
                  <span className="text-foreground">{l.title}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function WidgetToggle({ id, hidden, onToggle }: { id: string; hidden: boolean; onToggle: (id: string) => void }) {
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggle(id)} title={hidden ? 'Show' : 'Hide'}>
      {hidden ? <Plus className="h-3.5 w-3.5" /> : <span className="text-lg leading-none text-muted-foreground">×</span>}
    </Button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
        <ScanLine className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">Nothing here yet</p>
      <p className="mt-1 text-xs text-muted-foreground">Run your first analysis to see insights here.</p>
      <Button asChild size="sm" className="mt-4">
        <Link href="/dashboard/analyze">Start analysis</Link>
      </Button>
    </div>
  );
}

function RiskGauge({ score }: { score: number }) {
  const band = riskBand(score);
  const color = band === 'low' ? 'hsl(var(--success))' : band === 'moderate' ? 'hsl(var(--accent))' : band === 'high' ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-36 w-36 items-center justify-center">
        <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 327} 327`}
          />
        </svg>
        <div className="absolute text-center">
          <p className="font-display text-3xl font-bold text-foreground">{score}</p>
          <p className="text-xs text-muted-foreground">/ 100</p>
        </div>
      </div>
      <Badge
        variant="outline"
        className="mt-3"
        style={{ color, borderColor: color }}
      >
        {band === 'low' ? 'Low Risk' : band === 'moderate' ? 'Moderate Risk' : band === 'high' ? 'High Risk' : 'Critical Risk'}
      </Badge>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Based on your highest-scoring analysis. Scores are estimates and never guarantee absolute safety.
      </p>
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  const band = riskBand(score);
  const cls = band === 'low' ? 'border-success/40 text-success' : band === 'moderate' ? 'border-accent/40 text-accent-foreground' : band === 'high' ? 'border-warning/40 text-warning-foreground' : 'border-destructive/40 text-destructive';
  return <Badge variant="outline" className={cn('text-xs', cls)}>{score}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    analyzed: 'border-muted-foreground/40 text-muted-foreground',
    protected: 'border-success/40 text-success',
    analyzing: 'border-warning/40 text-warning-foreground',
    failed: 'border-destructive/40 text-destructive',
  };
  return <Badge variant="outline" className={cn('text-xs capitalize', map[status])}>{status}</Badge>;
}

function StatRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value} · {pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function Recommendation({ icon: Icon, color, title, body, action }: { icon: React.ComponentType<{ className?: string }>; color: string; title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-md border border-border/40 p-3">
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', color)} />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
        <div className="mt-2">{action}</div>
      </div>
    </div>
  );
}