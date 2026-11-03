'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Loader2, Download, FileJson, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/providers';
import { supabase, type AnalysisRow, type DetectionRow } from '@/lib/supabase';
import { CATEGORY_LABELS, type PiiCategory, riskBand } from '@/lib/pii-engine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const { session } = useAuth();
  const [rows, setRows] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!session) return;
      const { data } = await supabase.from('analyses').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
      setRows((data as AnalysisRow[]) ?? []);
      setLoading(false);
    })();
  }, [session]);

  async function downloadJson(a: AnalysisRow) {
    if (!session) return;
    const { data: d } = await supabase.from('detections').select('*').eq('analysis_id', a.id).eq('user_id', session.user.id);
    const report = {
      analysis_id: a.id,
      generated_at: new Date().toISOString(),
      file_name: a.original_filename,
      source_kind: a.source_kind,
      language: a.language,
      risk_score: a.risk_score,
      risk_band: a.risk_score != null ? riskBand(a.risk_score) : null,
      detection_count: a.detection_count,
      status: a.status,
      created_at: a.created_at,
      processing_ms: a.processing_ms,
      detections: (d as DetectionRow[])?.map((det) => ({
        category: det.category,
        label: CATEGORY_LABELS[det.category as PiiCategory] ?? det.category,
        masked_value: det.masked_value,
        location: det.location,
        confidence: det.confidence,
        severity: det.severity,
        why_sensitive: det.why_sensitive,
        why_matters: det.why_matters,
        recommended_action: det.recommended_action,
        redaction_status: det.redaction_status,
        verification_status: det.verification_status,
      })) ?? [],
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `privacy-report-${a.id.slice(0, 8)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    if (session) {
      await supabase.from('reports').insert({ user_id: session.user.id, analysis_id: a.id, format: 'json', risk_score: a.risk_score, detection_count: a.detection_count });
      await supabase.from('activity').insert({ user_id: session.user.id, event: 'report_downloaded', detail: 'json' });
    }
    toast.success('Report downloaded');
  }

  const sevColor = (s: number | null) => s == null ? 'text-muted-foreground' : s > 70 ? 'text-destructive' : s > 40 ? 'text-warning-foreground' : s > 20 ? 'text-accent-foreground' : 'text-success';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Privacy Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Generate and download detailed reports for any analysis. Sensitive values are always masked in reports.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No reports available</p>
            <p className="mt-1 text-xs text-muted-foreground">Run an analysis first, then generate a report.</p>
            <Button asChild size="sm" className="mt-4"><Link href="/dashboard/analyze">Start analysis</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((a) => (
            <Card key={a.id} className="border-border/60">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{a.original_filename || `${a.source_kind} analysis`}</CardTitle>
                    <CardDescription>{new Date(a.created_at).toLocaleString()}</CardDescription>
                  </div>
                  <FileJson className="h-5 w-5 shrink-0 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline" className={cn('text-xs', sevColor(a.risk_score))}>Score {a.risk_score ?? 0}/100</Badge>
                  <Badge variant="outline" className="text-xs">{a.detection_count} findings</Badge>
                  {a.status === 'protected' && <Badge variant="outline" className="border-success/40 text-success text-xs"><ShieldCheck className="mr-1 h-3 w-3" />Protected</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => downloadJson(a)}><Download className="mr-2 h-3.5 w-3.5" /> JSON report</Button>
                  <Button size="sm" variant="ghost" asChild><Link href={`/dashboard/threats?id=${a.id}`}>View findings</Link></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}