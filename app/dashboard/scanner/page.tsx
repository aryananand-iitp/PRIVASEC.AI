'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback } from 'react';
import { Video } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/providers';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { detectLanguageHint } from '@/lib/pii-engine';
import { segmentsToText, type TranscriptSegment } from '@/lib/transcribe';
import { StepIndicator } from './step-indicator';
import { scannerSteps, type StepStatus } from './steps';
import { InputStep, type InputSelection } from './input-step';
import { ExtractStep, type ExtractionResult } from './extract-step';
import { ReviewStep } from './review-step';
import { ScanStep, type ScanResult } from './scan-step';
import { ReportStep } from './report-step';

type Phase = 0 | 1 | 2 | 3 | 4;

export default function ScannerPage() {
  const { session } = useAuth();
  const [phase, setPhase] = useState<Phase>(0);
  const [input, setInput] = useState<InputSelection | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);

  const statuses: StepStatus[] = scannerSteps.map((_, idx) => {
    if (idx < phase) return 'complete';
    if (idx === phase) return 'active';
    return 'pending';
  });

  const handleInputContinue = useCallback((sel: InputSelection) => {
    setInput(sel);
    setPhase(1);
  }, []);

  const handleExtractContinue = useCallback((result: ExtractionResult) => {
    setExtraction(result);
    setSegments(result.segments);
    setPhase(2);
  }, []);

  const handleReviewContinue = useCallback((segs: TranscriptSegment[]) => {
    setSegments(segs);
    setPhase(3);
  }, []);

  const handleScanContinue = useCallback(async (result: ScanResult) => {
    setScanResult(result);
    setPhase(4);
    // Save to database
    if (session && extraction) {
      try {
        const text = result.text;
        const lang = detectLanguageHint(text);
        const { data: analysis, error } = await supabase
          .from('analyses')
          .insert({
            user_id: session.user.id,
            source_kind: extraction.mode === 'live' ? 'speech' : extraction.mode,
            original_filename: input?.filename ?? null,
            original_text: text,
            risk_score: result.score,
            status: 'analyzed',
            detection_count: result.findings.filter((f) => !result.falsePositives.has(`${f.category}|${f.start}`)).length,
            language: lang,
          })
          .select('id')
          .single();
        if (!error && analysis) {
          setSavedAnalysisId(analysis.id);
          if (result.findings.length > 0) {
            const rows = result.findings.map((f) => ({
              analysis_id: analysis.id,
              user_id: session.user.id,
              category: f.category,
              masked_value: f.masked_value,
              snippet: f.snippet,
              location: f.location,
              confidence: f.confidence,
              severity: f.severity,
              why_sensitive: f.why_sensitive,
              why_matters: f.why_matters,
              recommended_action: f.recommended_action,
              redaction_status: 'none' as const,
              verification_status: 'unverified' as const,
            }));
            await supabase.from('detections').insert(rows);
          }
          await supabase.from('media_scans').insert({
            user_id: session.user.id,
            analysis_id: analysis.id,
            input_type: extraction.mode,
            original_filename: input?.filename ?? null,
            media_duration_s: input?.durationS ?? null,
            segment_count: segments.length,
            transcript: text,
            language: lang,
          });
          await supabase.from('activity').insert({
            user_id: session.user.id,
            event: 'analysis_completed',
            detail: `Multimedia scan: ${result.findings.length} findings · score ${result.score}`,
          });
          await supabase.from('notifications').insert({
            user_id: session.user.id,
            title: result.findings.length > 0 ? `Multimedia scan complete: ${result.findings.length} findings` : 'Multimedia scan complete: no findings',
            body: result.score > 40 ? 'High-risk content detected. Review and protect before sharing.' : 'Your media has been analyzed.',
            kind: result.score > 70 ? 'danger' : result.score > 40 ? 'warning' : 'success',
          });
        }
      } catch (err) {
        toast.error('Could not save scan', { description: err instanceof Error ? err.message : 'Unknown error' });
      }
    }
  }, [session, extraction, input, segments]);

  const goBack = useCallback((target: Phase) => {
    setPhase(target);
  }, []);

  const restart = useCallback(() => {
    setPhase(0);
    setInput(null);
    setExtraction(null);
    setSegments([]);
    setScanResult(null);
    setSavedAnalysisId(null);
  }, []);

  const rescan = useCallback(() => {
    setScanResult(null);
    setPhase(3);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Video className="h-6 w-6 text-primary" />
          Multimedia Privacy Scanner
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload video or audio, or record live, then transcribe and scan for personal information before sharing.
        </p>
      </div>

      <Card className="border-border/60">
        <CardContent className="py-4">
          <StepIndicator current={phase} statuses={statuses} />
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">{scannerSteps[phase].label}</CardTitle>
          <p className="text-xs text-muted-foreground">{scannerSteps[phase].description}</p>
        </CardHeader>
        <CardContent>
          {phase === 0 && <InputStep onContinue={handleInputContinue} />}
          {phase === 1 && input && (
            <ExtractStep input={input} onContinue={handleExtractContinue} onBack={() => goBack(0)} />
          )}
          {phase === 2 && (
            <ReviewStep segments={segments} onContinue={handleReviewContinue} onBack={() => goBack(1)} />
          )}
          {phase === 3 && (
            <ScanStep segments={segments} onContinue={handleScanContinue} onBack={() => goBack(2)} />
          )}
          {phase === 4 && scanResult && (
            <ReportStep
              result={scanResult}
              segments={segments}
              onRescan={rescan}
              onRestart={restart}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}