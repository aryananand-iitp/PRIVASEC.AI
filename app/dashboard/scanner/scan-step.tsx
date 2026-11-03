'use client';

import { useState } from 'react';
import { Loader2, ScanLine, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { explainFindings, computeRiskScore, riskBand, CATEGORY_LABELS, type Finding, type PiiCategory } from '@/lib/pii-engine';
import { segmentsToText, type TranscriptSegment } from '@/lib/transcribe';

export type ScanResult = {
  findings: Finding[];
  score: number;
  falsePositives: Set<string>;
  text: string;
};

export function ScanStep({
  segments,
  onContinue,
  onBack,
}: {
  segments: TranscriptSegment[];
  onContinue: (result: ScanResult) => void;
  onBack: () => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [score, setScore] = useState(0);
  const [falsePositives, setFalsePositives] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);

  async function runScan() {
    setScanning(true);
    setFindings([]);
    setDone(false);
    // Small delay so the UI can show the scanning state
    await new Promise((r) => setTimeout(r, 400));
    const text = segmentsToText(segments);
    const detected = explainFindings(text);
    const riskScore = computeRiskScore(detected);
    setFindings(detected);
    setScore(riskScore);
    setScanning(false);
    setDone(true);
    if (detected.length === 0) {
      toast.success('No personal information detected', { description: 'The transcript appears clean.' });
    } else {
      toast.info(`${detected.length} findings detected`, { description: `Risk score: ${riskScore}/100.` });
    }
  }

  function toggleFalsePositive(key: string) {
    setFalsePositives((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleContinue() {
    const text = segmentsToText(segments);
    onContinue({ findings, score, falsePositives, text });
  }

  const band = riskBand(score);
  const bandColor = band === 'low' ? 'text-success' : band === 'moderate' ? 'text-accent-foreground' : band === 'high' ? 'text-warning-foreground' : 'text-destructive';
  const bandBg = band === 'low' ? 'bg-success/10 border-success/30' : band === 'moderate' ? 'bg-accent/10 border-accent/30' : band === 'high' ? 'bg-warning/10 border-warning/30' : 'bg-destructive/10 border-destructive/30';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">PII Detection Scan</h3>
          <p className="text-sm text-muted-foreground">Scanning the transcript for personal information using the PII engine.</p>
        </div>
        {done && (
          <div className={cn('rounded-lg border px-4 py-2 text-center', bandBg)}>
            <p className={cn('font-display text-2xl font-bold', bandColor)}>{score}</p>
            <p className="text-xs text-muted-foreground">{band} risk</p>
          </div>
        )}
      </div>

      {!done && !scanning && (
        <Card className="border-border/60">
          <CardContent className="py-8 text-center">
            <ScanLine className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">Ready to scan</p>
            <p className="mt-1 text-xs text-muted-foreground">Click below to run the PII detection engine on the confirmed transcript.</p>
            <Button className="mt-4" onClick={runScan}>
              <ScanLine className="mr-2 h-4 w-4" /> Start PII scan
            </Button>
          </CardContent>
        </Card>
      )}

      {scanning && (
        <Card className="border-border/60">
          <CardContent className="py-8 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm font-medium text-foreground">Scanning for personal information…</p>
          </CardContent>
        </Card>
      )}

      {done && findings.length === 0 && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="mt-3 text-sm font-medium text-foreground">No personal information detected</p>
            <p className="mt-1 max-w-sm mx-auto text-xs text-muted-foreground">The PII engine found no high-confidence patterns in the transcript. Always review content yourself before sharing.</p>
          </CardContent>
        </Card>
      )}

      {done && findings.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span>{findings.length} findings detected. Review each one — mark false positives to exclude them from the report.</span>
          </div>
          <div className="max-h-[380px] space-y-2 overflow-y-auto scrollbar-thin">
            {findings.map((f, i) => {
              const key = `${f.category}|${f.start}`;
              const isFP = falsePositives.has(key);
              const sevColor =
                f.severity === 'critical' ? 'border-destructive/40 text-destructive'
                : f.severity === 'high' ? 'border-warning/40 text-warning-foreground'
                : f.severity === 'medium' ? 'border-accent/40 text-accent-foreground'
                : 'border-muted-foreground/40 text-muted-foreground';
              return (
                <div key={i} className={cn('rounded-md border p-3 transition-opacity', isFP ? 'opacity-50 border-dashed' : 'border-border/60')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('text-xs', sevColor)}>{f.severity}</Badge>
                        <span className="text-sm font-medium text-foreground">{CATEGORY_LABELS[f.category]}</span>
                        <span className="text-xs text-muted-foreground">{Math.round(f.confidence * 100)}% confidence</span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{f.masked_value}</p>
                      <p className="mt-1 text-xs text-muted-foreground italic">&ldquo;{f.snippet}&rdquo;</p>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <p><span className="font-medium text-foreground">Why it matters:</span> {f.why_matters}</p>
                        <p><span className="font-medium text-foreground">Action:</span> {f.recommended_action}</p>
                      </div>
                    </div>
                    <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                      <Checkbox checked={isFP} onCheckedChange={() => toggleFalsePositive(key)} />
                      <span>False positive</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>Back</Button>
        <Button onClick={handleContinue} disabled={!done || scanning}>
          View Privacy Report
        </Button>
      </div>
    </div>
  );
}