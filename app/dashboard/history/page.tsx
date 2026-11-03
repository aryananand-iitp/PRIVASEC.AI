'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { History, Loader2, Search, FileText, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/providers';
import { supabase, type AnalysisRow } from '@/lib/supabase';
import { riskBand } from '@/lib/pii-engine';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function HistoryPage() {
  const { session } = useAuth();
  const [rows, setRows] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    (async () => {
      if (!session) return;
      const { data } = await supabase
        .from('analyses')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      setRows((data as AnalysisRow[]) ?? []);
      setLoading(false);
    })();
  }, [session]);

  const filtered = rows.filter((r) => {
    if (typeFilter !== 'all' && r.source_kind !== typeFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!(r.original_filename ?? '').toLowerCase().includes(q) && !(r.original_text ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sevColor = (s: string) =>
    s === 'critical' ? 'text-destructive' : s === 'high' ? 'text-warning-foreground' : s === 'medium' ? 'text-accent-foreground' : 'text-muted-foreground';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Analysis History</h1>
        <p className="mt-1 text-sm text-muted-foreground">All your past analyses, filterable and searchable.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by file name or content…" className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="subtitle">Subtitle</SelectItem>
            <SelectItem value="metadata">Metadata</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="analyzed">Analyzed</SelectItem>
            <SelectItem value="protected">Protected</SelectItem>
            <SelectItem value="analyzing">Analyzing</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <History className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No analyses yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Run your first analysis to start building history.</p>
            <Button asChild size="sm" className="mt-4"><Link href="/dashboard/analyze">Start analysis</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {filtered.map((r) => {
                const band = r.risk_score != null ? riskBand(r.risk_score) : 'low';
                return (
                  <Link key={r.id} href={`/dashboard/threats?id=${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{r.original_filename || `${r.source_kind} analysis`}</p>
                        <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.detection_count} findings · {r.processing_ms ?? 0}ms</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {r.risk_score != null && <Badge variant="outline" className={cn('text-xs capitalize', sevColor(band))}>{r.risk_score}</Badge>}
                      <Badge variant="outline" className={cn('text-xs capitalize', r.status === 'protected' ? 'border-success/40 text-success' : 'border-muted-foreground/40 text-muted-foreground')}>
                        {r.status === 'protected' && <ShieldCheck className="mr-1 h-3 w-3" />}{r.status}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}