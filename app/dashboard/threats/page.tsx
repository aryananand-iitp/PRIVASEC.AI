'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Loader2, Filter, ChevronDown } from 'lucide-react';
import { useAuth } from '@/components/providers';
import { supabase, type AnalysisRow, type DetectionRow } from '@/lib/supabase';
import { CATEGORY_LABELS, type PiiCategory } from '@/lib/pii-engine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type SeverityFilter = 'all' | 'low' | 'medium' | 'high' | 'critical';

export default function ThreatsPage() {
  const params = useSearchParams();
  const id = params.get('id');
  const { session } = useAuth();
  const [analysis, setAnalysis] = useState<AnalysisRow | null>(null);
  const [detections, setDetections] = useState<DetectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sevFilter, setSevFilter] = useState<SeverityFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!session || !id) { setLoading(false); return; }
      const [{ data: a }, { data: d }] = await Promise.all([
        supabase.from('analyses').select('*').eq('id', id).eq('user_id', session.user.id).maybeSingle(),
        supabase.from('detections').select('*').eq('analysis_id', id).eq('user_id', session.user.id).order('severity', { ascending: false }),
      ]);
      setAnalysis(a as AnalysisRow | null);
      setDetections((d as DetectionRow[]) ?? []);
      setLoading(false);
    })();
  }, [session, id]);

  const filtered = detections.filter((d) => sevFilter === 'all' || d.severity === sevFilter);

  const sevColor = (s: string) =>
    s === 'critical' ? 'border-destructive/40 text-destructive' :
    s === 'high' ? 'border-warning/40 text-warning-foreground' :
    s === 'medium' ? 'border-accent/40 text-accent-foreground' :
    'border-muted-foreground/40 text-muted-foreground';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Threat & Detection Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every detected item, explained in plain language.</p>
        </div>
        <Button asChild variant="outline" size="sm"><Link href="/dashboard/history"><ArrowLeft className="mr-2 h-4 w-4" /> Back to history</Link></Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !analysis ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No analysis selected</p>
            <p className="mt-1 text-xs text-muted-foreground">Open an analysis from your history to see its detections here.</p>
            <Button asChild size="sm" className="mt-4"><Link href="/dashboard/history">View history</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-border/60">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="font-medium text-foreground">{analysis.original_filename || `${analysis.source_kind} analysis`}</p>
                <p className="text-xs text-muted-foreground">{new Date(analysis.created_at).toLocaleString()} · {analysis.detection_count} findings</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-display text-2xl font-bold text-foreground">{analysis.risk_score ?? 0}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                  <p className="text-xs text-muted-foreground">Risk score</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={sevFilter} onValueChange={(v) => setSevFilter(v as SeverityFilter)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Filter severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{filtered.length} of {detections.length}</span>
          </div>

          {filtered.length === 0 ? (
            <Card className="border-border/60"><CardContent className="py-10 text-center text-sm text-muted-foreground">No findings match this filter.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((d) => {
                const key = d.id;
                const isOpen = expanded === key;
                return (
                  <Card key={key} className="border-border/60">
                    <CardContent className="p-4">
                      <button onClick={() => setExpanded(isOpen ? null : key)} className="flex w-full items-start justify-between gap-3 text-left">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={cn('text-xs', sevColor(d.severity))}>{d.severity}</Badge>
                            <span className="text-sm font-medium text-foreground">{CATEGORY_LABELS[d.category as PiiCategory] ?? d.category}</span>
                            <span className="text-xs text-muted-foreground">· {d.location} · {Math.round(d.confidence * 100)}% confidence</span>
                          </div>
                          <p className="mt-1.5 font-mono text-xs text-muted-foreground">{d.masked_value}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{d.snippet}</p>
                        </div>
                        <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                      </button>
                      {isOpen && (
                        <div className="mt-3 space-y-2 border-t border-border/40 pt-3 text-sm">
                          <Exp label="Why this is sensitive" value={d.why_sensitive} />
                          <Exp label="Why it matters" value={d.why_matters} />
                          <Exp label="Recommended action" value={d.recommended_action} />
                          <div className="flex flex-wrap gap-2 pt-1 text-xs">
                            <Badge variant="secondary">Redaction: {d.redaction_status}</Badge>
                            <Badge variant="secondary">Verification: {d.verification_status}</Badge>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="flex justify-end">
            <Button asChild><Link href={`/dashboard/protection?id=${analysis.id}`}>Protect this content</Link></Button>
          </div>
        </>
      )}
    </div>
  );
}

function Exp({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-foreground">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{value}</p>
    </div>
  );
}