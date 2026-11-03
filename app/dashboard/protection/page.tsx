'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle, Download, FileLock2 } from 'lucide-react';
import { useAuth } from '@/components/providers';
import { supabase, type AnalysisRow, type DetectionRow } from '@/lib/supabase';
import { applyRedaction, verifyRedaction, type RedactMode, CATEGORY_LABELS, type PiiCategory } from '@/lib/pii-engine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ProtectionPage() {
  const params = useSearchParams();
  const id = params.get('id');
  const { session } = useAuth();
  const [analysis, setAnalysis] = useState<AnalysisRow | null>(null);
  const [detections, setDetections] = useState<DetectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<RedactMode>('redact');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [protectedText, setProtectedText] = useState<string | null>(null);
  const [verification, setVerification] = useState<{ removedCount: number; remainingCount: number; remainingValues: string[]; finalScore: number } | null>(null);
  const [applying, setApplying] = useState(false);

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

  // Map stored detections back into Finding-like shapes for the engine.
  const findings = useMemo(() => detections.map((d) => ({
    category: d.category as PiiCategory,
    value: '', // We don't store raw values; we operate on snippet instead.
    start: 0,
    end: 0,
    confidence: d.confidence,
    masked_value: d.masked_value,
    snippet: d.snippet,
    location: d.location,
    severity: d.severity,
    why_sensitive: d.why_sensitive,
    why_matters: d.why_matters,
    recommended_action: d.recommended_action,
  })), [detections]);

  function toggle(key: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function selectAll() { setSelected(new Set(detections.map((d) => d.id))); }
  function deselectAll() { setSelected(new Set()); }

  async function applyProtection() {
    if (!analysis || !analysis.original_text || !session) return;
    setApplying(true);
    setVerification(null);
    // Re-detect on the original text so we have real offsets to replace.
    const { explainFindings } = await import('@/lib/pii-engine');
    const fresh = explainFindings(analysis.original_text);
    // Match stored detections to fresh findings by masked_value+category for selection.
    const selectedCats = new Set(detections.filter((d) => selected.has(d.id)).map((d) => d.category + '|' + d.masked_value));
    const toApply = fresh.filter((f) => selectedCats.has(f.category + '|' + f.masked_value));
    // Use a keyed selection set that matches fresh findings' category+start.
    const freshSelected = new Set(toApply.map((f) => f.category + '|' + f.start));
    const out = applyRedaction(analysis.original_text, fresh, mode, freshSelected);
    setProtectedText(out);
    const ver = verifyRedaction(out, fresh.filter((f) => selectedCats.has(f.category + '|' + f.masked_value)));
    setVerification(ver);

    // Persist protected text + update detection statuses.
    await supabase.from('analyses').update({ protected_text: out, status: 'protected' }).eq('id', analysis.id);
    const ids = detections.filter((d) => selected.has(d.id)).map((d) => d.id);
    if (ids.length) {
      await supabase.from('detections')
        .update({ redaction_status: mode, verification_status: ver.remainingCount === 0 ? 'verified_passed' : 'verified_failed' })
        .in('id', ids);
    }
    await supabase.from('activity').insert({ user_id: session.user.id, event: 'protection_applied', detail: `${mode} · ${ids.length} findings` });
    await supabase.from('notifications').insert({
      user_id: session.user.id,
      title: 'Protection applied',
      body: ver.remainingCount === 0 ? 'All selected findings were removed and verified.' : `${ver.remainingCount} findings could not be fully removed.`,
      kind: ver.remainingCount === 0 ? 'success' : 'warning',
    });
    setApplying(false);
    toast.success('Protection applied', { description: ver.remainingCount === 0 ? 'Verified clean.' : `${ver.remainingCount} remaining.` });
  }

  function downloadProtected() {
    if (!protectedText || !analysis) return;
    const blob = new Blob([protectedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protected-${analysis.original_filename || 'analysis.txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sevColor = (s: string) =>
    s === 'critical' ? 'border-destructive/40 text-destructive' :
    s === 'high' ? 'border-warning/40 text-warning-foreground' :
    s === 'medium' ? 'border-accent/40 text-accent-foreground' :
    'border-muted-foreground/40 text-muted-foreground';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Protection Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">Mask or permanently redact selected findings, then verify the output is clean.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !analysis ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldCheck className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No analysis selected</p>
            <Button asChild size="sm" className="mt-4"><Link href="/dashboard/history">View history</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mode selection */}
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-lg">Protection mode</CardTitle><CardDescription>Choose how to handle the selected findings.</CardDescription></CardHeader>
            <CardContent>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as RedactMode)} className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                <div className="flex items-start gap-3 rounded-md border border-border/60 p-3">
                  <RadioGroupItem value="redact" id="redact" />
                  <div>
                    <Label htmlFor="redact" className="flex items-center gap-2 text-sm font-medium"><EyeOff className="h-4 w-4" /> Permanent redaction</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Replace with [REDACTED]. The underlying text is removed from the export.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-md border border-border/60 p-3">
                  <RadioGroupItem value="mask" id="mask" />
                  <div>
                    <Label htmlFor="mask" className="flex items-center gap-2 text-sm font-medium"><Eye className="h-4 w-4" /> Masking</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Partially hide the value (e.g. arn****@email.com). Some context remains.</p>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Findings selection */}
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div><CardTitle className="text-lg">Findings ({detections.length})</CardTitle><CardDescription>Select which to protect.</CardDescription></div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll}>Select all</Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll}>Deselect all</Button>
                </div>
              </CardHeader>
              <CardContent className="max-h-[420px] space-y-2 overflow-y-auto scrollbar-thin">
                {detections.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No findings to protect.</p>
                ) : detections.map((d) => (
                  <label key={d.id} className={cn('flex items-start gap-3 rounded-md border p-3 transition-colors', selected.has(d.id) ? 'border-accent/50 bg-accent/5' : 'border-border/40')}>
                    <Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggle(d.id)} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn('text-xs', sevColor(d.severity))}>{d.severity}</Badge>
                        <span className="text-sm font-medium text-foreground">{CATEGORY_LABELS[d.category as PiiCategory] ?? d.category}</span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{d.masked_value}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{d.location}</p>
                    </div>
                  </label>
                ))}
              </CardContent>
            </Card>

            {/* Preview + verification */}
            <Card className="border-border/60">
              <CardHeader><CardTitle className="text-lg">Protected preview</CardTitle><CardDescription>Original vs protected, side by side.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Original</p>
                  <pre className="max-h-32 overflow-y-auto scrollbar-thin whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-foreground">
{analysis.original_text || '(no text stored for this analysis)'}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Protected</p>
                  <pre className="max-h-32 overflow-y-auto scrollbar-thin whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-foreground">
{protectedText ?? '(apply protection to see the result)'}
                  </pre>
                </div>

                {verification && (
                  <div className={cn('rounded-md border p-3 text-sm', verification.remainingCount === 0 ? 'border-success/40 bg-success/5 text-success' : 'border-warning/40 bg-warning/5 text-warning-foreground')}>
                    <div className="flex items-center gap-2 font-medium">
                      {verification.remainingCount === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      {verification.remainingCount === 0 ? 'Post-redaction verified: all selected findings removed' : `${verification.remainingCount} findings could not be fully removed`}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Removed: {verification.removedCount} · Remaining: {verification.remainingCount} · Final risk score: {verification.finalScore}/100</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={applyProtection} disabled={applying || selected.size === 0 || !analysis.original_text}>
                    {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileLock2 className="mr-2 h-4 w-4" />}
                    {applying ? 'Applying…' : `Apply ${mode} (${selected.size})`}
                  </Button>
                  <Button variant="outline" onClick={downloadProtected} disabled={!protectedText}>
                    <Download className="mr-2 h-4 w-4" /> Download protected
                  </Button>
                </div>
                {selected.size > 0 && (
                  <p className="text-xs text-muted-foreground">This will replace {selected.size} finding{selected.size === 1 ? '' : 's'} in the export. The change is irreversible for the exported file.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}