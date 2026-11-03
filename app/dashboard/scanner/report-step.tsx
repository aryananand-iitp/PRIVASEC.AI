'use client';

import { useMemo } from 'react';
import { BarChart3, AlertTriangle, CheckCircle2, RotateCcw, ShieldCheck, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { riskBand, CATEGORY_LABELS, type Finding, type PiiCategory } from '@/lib/pii-engine';
import type { ScanResult } from './scan-step';
import type { TranscriptSegment } from '@/lib/transcribe';

export function ReportStep({
  result,
  segments,
  onRescan,
  onRestart,
}: {
  result: ScanResult;
  segments: TranscriptSegment[];
  onRescan: () => void;
  onRestart: () => void;
}) {
  const { findings, score, falsePositives, text } = result;
  const validFindings = useMemo(
    () => findings.filter((f) => !falsePositives.has(`${f.category}|${f.start}`)),
    [findings, falsePositives],
  );
  const validScore = useMemo(() => {
    if (validFindings.length === 0) return 0;
    // Recompute without false positives
    let raw = 0;
    const weights: Record<string, number> = { low: 4, medium: 12, high: 25, critical: 40 };
    for (const f of validFindings) raw += weights[f.severity] * f.confidence;
    return Math.max(1, Math.min(100, Math.round(raw / (1 + raw * 0.012))));
  }, [validFindings]);

  const band = riskBand(validScore);
  const bandLabel = band.charAt(0).toUpperCase() + band.slice(1);
  const bandColor = band === 'low' ? 'text-success' : band === 'moderate' ? 'text-accent-foreground' : band === 'high' ? 'text-warning-foreground' : 'text-destructive';
  const bandBg = band === 'low' ? 'bg-success/10 border-success/30' : band === 'moderate' ? 'bg-accent/10 border-accent/30' : band === 'high' ? 'bg-warning/10 border-warning/30' : 'bg-destructive/10 border-destructive/30';

  // Category summary
  const byCategory = useMemo(() => {
    const m = new Map<PiiCategory, number>();
    for (const f of validFindings) m.set(f.category, (m.get(f.category) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [validFindings]);

  // Risk distribution
  const bySeverity = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of validFindings) m.set(f.severity, (m.get(f.severity) ?? 0) + 1);
    return m;
  }, [validFindings]);

  // Build highlighted transcript
  const highlightedSegments = useMemo(() => {
    // Rebuild offsets per segment
    let offset = 0;
    const offsets: number[] = [];
    for (const s of segments) {
      offsets.push(offset);
      offset += s.text.length + 1;
    }
    return segments.map((s, idx) => {
      const segStart = offsets[idx];
      const segEnd = segStart + s.text.length;
      const segFindings = validFindings
        .filter((f) => f.start >= segStart && f.start < segEnd)
        .map((f) => ({ ...f, relStart: f.start - segStart, relEnd: f.end - segStart }));
      return { ...s, segFindings };
    });
  }, [segments, validFindings]);

  function downloadReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      riskScore: validScore,
      riskBand: band,
      totalFindings: validFindings.length,
      falsePositivesExcluded: falsePositives.size,
      categorySummary: Object.fromEntries(byCategory.map(([cat, n]) => [CATEGORY_LABELS[cat], n])),
      riskDistribution: Object.fromEntries(bySeverity),
      recommendations: validFindings.map((f) => ({
        category: CATEGORY_LABELS[f.category],
        severity: f.severity,
        maskedValue: f.masked_value,
        recommendation: f.recommended_action,
      })),
      transcriptLength: text.length,
      segmentCount: segments.length,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `privacy-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Privacy Report</h3>
          <p className="text-sm text-muted-foreground">Complete analysis summary with recommendations for protecting your content.</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadReport}>
          <FileDown className="mr-1.5 h-3.5 w-3.5" /> Download report
        </Button>
      </div>

      {/* Overall risk score */}
      <Card className={cn('border-2', bandBg)}>
        <CardContent className="py-5">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className={cn('font-display text-4xl font-bold', bandColor)}>{validScore}</p>
              <p className="text-xs text-muted-foreground">/ 100</p>
            </div>
            <div className="flex-1">
              <Badge variant="outline" style={{ color: 'inherit' }} className={cn('border-current', bandColor)}>
                {bandLabel} Risk
              </Badge>
              <p className="mt-2 text-sm text-muted-foreground">
                {validFindings.length === 0
                  ? 'No personal information was detected after excluding false positives. Always review content yourself before sharing.'
                  : `${validFindings.length} personal information finding${validFindings.length === 1 ? '' : 's'} detected in the transcript. Review the recommendations below before sharing.`}
              </p>
              {falsePositives.size > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{falsePositives.size} false positive{falsePositives.size === 1 ? '' : 's'} excluded from the score.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category summary + risk distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Detection Summary
            </CardTitle>
            <CardDescription>Findings by category</CardDescription>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No categories detected.</p>
            ) : (
              <div className="space-y-2">
                {byCategory.map(([cat, n]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{CATEGORY_LABELS[cat]}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(n / validFindings.length) * 100}%` }} />
                      </div>
                      <span className="w-5 text-right text-sm font-medium text-foreground">{n}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Risk Distribution
            </CardTitle>
            <CardDescription>Findings by severity</CardDescription>
          </CardHeader>
          <CardContent>
            {['critical', 'high', 'medium', 'low'].map((sev) => {
              const count = bySeverity.get(sev) ?? 0;
              const color = sev === 'critical' ? 'bg-destructive' : sev === 'high' ? 'bg-warning' : sev === 'medium' ? 'bg-accent' : 'bg-muted-foreground';
              return (
                <div key={sev} className="mb-2 flex items-center justify-between">
                  <span className="capitalize text-sm text-muted-foreground">{sev}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 rounded-full bg-muted">
                      <div className={cn('h-full rounded-full', color)} style={{ width: validFindings.length > 0 ? `${(count / validFindings.length) * 100}%` : '0%' }} />
                    </div>
                    <span className="w-5 text-right text-sm font-medium text-foreground">{count}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Highlighted transcript */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Highlighted Transcript</CardTitle>
          <CardDescription>Personal information is highlighted in the transcript below.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[320px] space-y-2 overflow-y-auto scrollbar-thin rounded-md border border-border/60 p-3">
            {highlightedSegments.map((seg) => (
              <div key={seg.id} className="flex gap-2 text-sm">
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatTime(seg.start)}</span>
                <span className="flex-1 text-foreground">{renderHighlighted(seg.text, seg.segFindings)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {validFindings.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Recommendations
            </CardTitle>
            <CardDescription>Actions to protect your content before sharing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {validFindings.map((f, i) => {
                const sevColor =
                  f.severity === 'critical' ? 'border-destructive/40 text-destructive'
                  : f.severity === 'high' ? 'border-warning/40 text-warning-foreground'
                  : f.severity === 'medium' ? 'border-accent/40 text-accent-foreground'
                  : 'border-muted-foreground/40 text-muted-foreground';
                return (
                  <div key={i} className="rounded-md border border-border/60 p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn('text-xs', sevColor)}>{f.severity}</Badge>
                      <span className="text-sm font-medium text-foreground">{CATEGORY_LABELS[f.category]}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{f.recommended_action}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {validFindings.length === 0 && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="mt-2 text-sm font-medium text-foreground">Content looks safe to share</p>
            <p className="mt-1 text-xs text-muted-foreground">No personal information was detected after excluding false positives. Always do a final manual review.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onRescan}>
          <RotateCcw className="mr-2 h-4 w-4" /> Rescan
        </Button>
        <Button onClick={onRestart}>
          Start new scan
        </Button>
      </div>
    </div>
  );
}

function renderHighlighted(text: string, findings: { relStart: number; relEnd: number; severity: string }[]) {
  if (findings.length === 0) return text;
  const sorted = [...findings].sort((a, b) => a.relStart - b.relStart);
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i];
    if (f.relStart > last) parts.push(text.slice(last, f.relStart));
    const cls = f.severity === 'critical' ? 'bg-destructive/20 text-destructive border border-destructive/30'
      : f.severity === 'high' ? 'bg-warning/20 text-warning-foreground border border-warning/30'
      : f.severity === 'medium' ? 'bg-accent/20 text-accent-foreground border border-accent/30'
      : 'bg-muted text-muted-foreground border border-muted-foreground/30';
    parts.push(
      <mark key={i} className={cn('rounded px-0.5 font-medium', cls)}>
        {text.slice(f.relStart, f.relEnd)}
      </mark>
    );
    last = f.relEnd;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function formatTime(s: number): string {
  if (!s) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}