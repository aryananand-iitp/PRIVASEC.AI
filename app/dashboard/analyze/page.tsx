'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ScanLine, FileText, Image as ImageIcon, FileVideo, FileAudio, Type,
  Upload, X, Loader2, AlertCircle, CheckCircle2, FileCheck2, Languages,
} from 'lucide-react';
import { useAuth } from '@/components/providers';
import { supabase } from '@/lib/supabase';
import { explainFindings, computeRiskScore, detectLanguageHint, CATEGORY_LABELS, type Finding } from '@/lib/pii-engine';
import { ocrImage, ocrPdf } from '@/lib/ocr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Kind = 'text' | 'image' | 'pdf' | 'video' | 'audio' | 'subtitle' | 'metadata';

const KIND_META: Record<Kind, { icon: React.ComponentType<{ className?: string }>; label: string; accept: string; formats: string }> = {
  text: { icon: Type, label: 'Text', accept: '.txt,text/plain', formats: 'TXT' },
  image: { icon: ImageIcon, label: 'Image', accept: '.jpg,.jpeg,.png,.webp,image/*', formats: 'JPG, PNG, WEBP' },
  pdf: { icon: FileText, label: 'PDF', accept: '.pdf,application/pdf', formats: 'PDF' },
  video: { icon: FileVideo, label: 'Video', accept: '.mp4,.mov,.webm,video/*', formats: 'MP4, MOV, WEBM' },
  audio: { icon: FileAudio, label: 'Audio', accept: '.mp3,.wav,.m4a,audio/*', formats: 'MP3, WAV, M4A' },
  subtitle: { icon: FileText, label: 'Subtitles', accept: '.srt,.vtt,.txt', formats: 'SRT, VTT, TXT' },
  metadata: { icon: FileCheck2, label: 'Metadata', accept: '.jpg,.jpeg,.png,.pdf', formats: 'JPG, PNG, PDF' },
};

const MAX_FILE_BYTES = 1024 * 1024 * 1024; // 1 GB
const MAX_TEXT_CHARS = 500_000; // browser memory safety cap for PII detection

export default function AnalyzePage() {
  const params = useSearchParams();
  const initialKind = (params.get('kind') as Kind) || 'text';
  const [kind, setKind] = useState<Kind>(initialKind);
  const { session } = useAuth();

  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('');
  const [processingPct, setProcessingPct] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [score, setScore] = useState(0);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [languageHint, setLanguageHint] = useState<string>('en');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialKind) setKind(initialKind as Kind);
  }, [initialKind]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (f.size > MAX_FILE_BYTES) {
      toast.error('File is too large', { description: 'Maximum size is 1 GB.' });
      return;
    }
    setFile(f);
    setExtractedText('');
    setProcessing(true);
    setProcessingPct(0);
    setProcessingLabel('Reading file…');

    try {
      let textContent = '';
      const name = f.name.toLowerCase();

      if (name.endsWith('.txt') || name.endsWith('.srt') || name.endsWith('.vtt') || f.type.startsWith('text/')) {
        setProcessingLabel('Reading text…');
        textContent = await f.text();
        if (name.endsWith('.srt') || name.endsWith('.vtt')) {
          textContent = textContent
            .split('\n')
            .filter((line) => !/^\d+$/.test(line.trim()) && !/^\d{2}:\d{2}:\d{2}/.test(line.trim()) && line.trim() !== '-->' && line.trim() !== 'WEBVTT')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
        setProcessingPct(100);
      } else if (name.endsWith('.pdf') || f.type === 'application/pdf') {
        setProcessingLabel('Extracting text from PDF…');
        const buf = await f.arrayBuffer();
        const embeddedText = extractTextFromPdf(buf);
        if (embeddedText.trim().length > 30) {
          textContent = embeddedText;
          setProcessingPct(100);
        } else {
          setProcessingLabel('Running OCR on PDF (this may take a minute)…');
          try {
            textContent = await ocrPdf(f, (p) => setProcessingPct(p));
            if (!textContent.trim()) {
              toast.info('OCR found no readable text', { description: 'The PDF may be blank or contain only graphics.' });
            }
          } catch {
            toast.error('PDF OCR failed', { description: 'Could not render this PDF for OCR. Try pasting text manually.' });
          }
        }
      } else if (name.endsWith('.docx')) {
        setProcessingLabel('Reading DOCX…');
        const buf = await f.arrayBuffer();
        textContent = await extractTextFromDocx(buf);
        if (!textContent.trim()) {
          toast.info('DOCX text extraction limited', { description: 'Could not extract text from this DOCX. Paste the text manually below.' });
        }
      } else if (/\.(jpg|jpeg|png|webp)$/i.test(name) || f.type.startsWith('image/')) {
        setProcessingLabel('Running OCR on image (this may take a minute)…');
        try {
          textContent = await ocrImage(f, (p) => setProcessingPct(p));
          if (!textContent.trim()) {
            toast.info('OCR found no readable text', { description: 'This image may not contain legible text.' });
          }
        } catch {
          toast.error('Image OCR failed', { description: 'Could not run OCR on this image. Try pasting text manually.' });
        }
      } else if (f.type.startsWith('video/') || f.type.startsWith('audio/')) {
        toast.info('Video/audio needs a transcript', {
          description: 'Browser-based speech-to-text is not available. Paste a transcript or subtitle file to run a real PII scan.',
        });
        setProcessingPct(100);
      } else {
        toast.info('Unsupported format', { description: 'Try uploading a text, image (JPG/PNG/WEBP), or PDF file.' });
        setProcessingPct(100);
      }

      if (textContent.length > MAX_TEXT_CHARS) {
        textContent = textContent.slice(0, MAX_TEXT_CHARS);
        toast.info('Content truncated', { description: `Only the first ${MAX_TEXT_CHARS.toLocaleString()} characters are analyzed for browser memory safety.` });
      }
      setExtractedText(textContent);
      setText(textContent);
    } catch (err) {
      toast.error('Could not read file', { description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setProcessing(false);
    }
  }, []);

  async function runAnalysis() {
    const content = text.trim();
    if (!content) {
      toast.error('Nothing to analyze', { description: 'Paste text or upload a file first.' });
      return;
    }
    if (!session) return;

    setAnalyzing(true);
    setFindings([]);
    setAnalysisId(null);

    const start = performance.now();
    await new Promise((r) => setTimeout(r, 350));
    const detected = explainFindings(content);
    const riskScore = computeRiskScore(detected);
    const lang = detectLanguageHint(content);
    const elapsed = Math.round(performance.now() - start);
    setLanguageHint(lang);

    const { data: analysis, error } = await supabase
      .from('analyses')
      .insert({
        user_id: session.user.id,
        source_kind: kind,
        original_filename: file?.name ?? null,
        original_text: content,
        risk_score: riskScore,
        status: 'analyzed',
        detection_count: detected.length,
        processing_ms: elapsed,
        language: lang,
      })
      .select('id')
      .single();

    if (error || !analysis) {
      toast.error('Could not save analysis', { description: error?.message ?? 'Unknown error' });
      setAnalyzing(false);
      return;
    }

    if (detected.length > 0) {
      const rows = detected.map((f) => ({
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

    await supabase.from('activity').insert({
      user_id: session.user.id,
      event: 'analysis_completed',
      detail: `${detected.length} findings · score ${riskScore}`,
    });
    await supabase.from('notifications').insert({
      user_id: session.user.id,
      title: detected.length > 0 ? `Analysis complete: ${detected.length} findings` : 'Analysis complete: no findings',
      body: riskScore > 40 ? 'High-risk content detected. Review and protect before sharing.' : 'Your content has been analyzed.',
      kind: riskScore > 70 ? 'danger' : riskScore > 40 ? 'warning' : 'success',
    });

    setFindings(detected);
    setScore(riskScore);
    setAnalysisId(analysis.id);
    setAnalyzing(false);
    toast.success('Analysis complete', { description: `${detected.length} personal information findings detected.` });
  }

  function clearAll() {
    setFile(null);
    setText('');
    setExtractedText('');
    setFindings([]);
    setScore(0);
    setAnalysisId(null);
    setProcessingPct(0);
    if (inputRef.current) inputRef.current.value = '';
  }

  const meta = KIND_META[kind];
  const isProcessing = processing || analyzing;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Analyze Your Content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload or paste content. We scan for personal information using OCR and pattern detection, explain each finding, and let you protect it.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(KIND_META) as Kind[]).map((k) => {
          const M = KIND_META[k];
          const Icon = M.icon;
          const active = kind === k;
          return (
            <button
              key={k}
              onClick={() => { setKind(k); clearAll(); }}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="h-4 w-4" />
              {M.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Input</CardTitle>
            <CardDescription>Supported formats: {meta.formats}. Max size 1 GB.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
                dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-muted-foreground/50'
              )}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-foreground">Drag & drop or browse</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{meta.formats} · up to 1 GB</p>
              <input
                ref={inputRef}
                type="file"
                accept={meta.accept}
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button variant="outline" size="sm" className="mt-3" onClick={() => inputRef.current?.click()}>
                Browse files
              </Button>
            </div>

            {file && (
              <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${(file.size / 1024).toFixed(1)} KB`} · {file.type || 'unknown'}
                    </p>
                  </div>
                </div>
                {processing ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {Math.round(processingPct)}%
                  </div>
                ) : (
                  <button onClick={() => { setFile(null); setExtractedText(''); setText(''); }} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            {processing && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{processingLabel}</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-accent transition-all" style={{ width: `${processingPct}%` }} />
                </div>
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Text to analyze</label>
                {extractedText && <Badge variant="secondary" className="text-xs">Extracted from file</Badge>}
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your text here, or upload a file above…"
                className="min-h-[200px] w-full resize-y rounded-md border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{text.length.toLocaleString()} characters</p>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={clearAll} disabled={isProcessing}>Clear</Button>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Languages className="h-3.5 w-3.5" /> Auto: {languageHint}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Detected language of your content (English detection is fully supported; other scripts are best-effort).</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button onClick={runAnalysis} disabled={isProcessing || !text.trim()}>
                  {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                  {analyzing ? 'Analyzing…' : 'Analyze content'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-lg">Results</CardTitle>
            <CardDescription>
              {analysisId ? `${findings.length} findings detected · risk score ${score}/100` : 'Results will appear here after analysis.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!analysisId && !analyzing && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                  <ScanLine className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">Ready when you are</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">Paste text or upload a file, then run the analysis to see detected personal information here.</p>
              </div>
            )}
            {analyzing && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-3 text-sm font-medium text-foreground">Scanning for personal information…</p>
              </div>
            )}
            {analysisId && findings.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-success" />
                <p className="mt-3 text-sm font-medium text-foreground">No personal information detected</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">Our engine found no high-confidence PII patterns. Always review content yourself before sharing.</p>
              </div>
            )}
            {analysisId && findings.length > 0 && (
              <Tabs defaultValue="findings">
                <TabsList className="w-full">
                  <TabsTrigger value="findings">Findings ({findings.length})</TabsTrigger>
                  <TabsTrigger value="risk">Risk score</TabsTrigger>
                </TabsList>
                <TabsContent value="findings" className="mt-3 max-h-[420px] space-y-2 overflow-y-auto scrollbar-thin">
                  {findings.map((f, i) => <FindingCard key={i} f={f} />)}
                </TabsContent>
                <TabsContent value="risk" className="mt-3 space-y-3">
                  <RiskScoreCard score={score} findings={findings} />
                </TabsContent>
              </Tabs>
            )}
            {analysisId && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline"><a href={`/dashboard/threats?id=${analysisId}`}>View in Threat Center</a></Button>
                <Button asChild size="sm"><a href={`/dashboard/protection?id=${analysisId}`}>Protect this content</a></Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Text and image OCR analysis runs entirely in your browser using Tesseract.js — no file bytes leave your device. PDF OCR uses pdf.js + Tesseract. Video frame analysis and audio transcription require server-side services not available in this environment — for those, paste a transcript or subtitle file. Original file bytes are never stored.
        </span>
      </div>
    </div>
  );
}

function FindingCard({ f }: { f: Finding }) {
  const sevColor = f.severity === 'critical' ? 'border-destructive/40 text-destructive' : f.severity === 'high' ? 'border-warning/40 text-warning-foreground' : f.severity === 'medium' ? 'border-accent/40 text-accent-foreground' : 'border-muted-foreground/40 text-muted-foreground';
  return (
    <div className="rounded-md border border-border/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn('text-xs', sevColor)}>{f.severity}</Badge>
            <span className="text-sm font-medium text-foreground">{CATEGORY_LABELS[f.category]}</span>
          </div>
          <p className="mt-1.5 font-mono text-xs text-muted-foreground">{f.masked_value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{f.location} · {Math.round(f.confidence * 100)}% confidence</p>
        </div>
      </div>
      <details className="mt-2 group">
        <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">Why is this risky?</summary>
        <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <p><span className="font-medium text-foreground">Why detected:</span> {CATEGORY_LABELS[f.category]} was found in the content.</p>
          <p><span className="font-medium text-foreground">Why it matters:</span> {f.why_matters}</p>
          <p><span className="font-medium text-foreground">Recommended action:</span> {f.recommended_action}</p>
        </div>
      </details>
    </div>
  );
}

function RiskScoreCard({ score, findings }: { score: number; findings: Finding[] }) {
  const band = score <= 20 ? 'Low' : score <= 40 ? 'Moderate' : score <= 70 ? 'High' : 'Critical';
  const color = score <= 20 ? 'hsl(var(--success))' : score <= 40 ? 'hsl(var(--accent))' : score <= 70 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';
  const bySeverity = new Map<string, number>();
  for (const f of findings) bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="font-display text-4xl font-bold" style={{ color }}>{score}</p>
          <p className="text-xs text-muted-foreground">/ 100</p>
        </div>
        <div>
          <Badge variant="outline" style={{ color, borderColor: color }}>{band} Risk</Badge>
          <p className="mt-2 text-xs text-muted-foreground">Score is an estimate based on finding sensitivity, confidence, and count. It never guarantees absolute safety.</p>
        </div>
      </div>
      <div className="space-y-2">
        {['critical', 'high', 'medium', 'low'].map((sev) => (
          <div key={sev} className="flex items-center justify-between text-sm">
            <span className="capitalize text-muted-foreground">{sev}</span>
            <span className="font-medium text-foreground">{bySeverity.get(sev) ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function extractTextFromPdf(buf: ArrayBuffer): string {
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(new Uint8Array(buf));
  let text = '';
  const blockRe = /BT([\s\S]*?)ET/g;
  let m;
  while ((m = blockRe.exec(raw)) !== null) {
    const block = m[1];
    const tjRe = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;
    let tm;
    while ((tm = tjRe.exec(block)) !== null) text += tm[1].replace(/\\(\(|\)|\\)/g, '$1') + ' ';
    const tjArrRe = /\[([^\]]*)\]\s*TJ/g;
    let tam;
    while ((tam = tjArrRe.exec(block)) !== null) {
      const parts = tam[1].match(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g);
      if (parts) for (const p of parts) text += p.slice(1, -1).replace(/\\(\(|\)|\\)/g, '$1');
    }
  }
  return text.trim();
}

async function extractTextFromDocx(buf: ArrayBuffer): Promise<string> {
  try {
    const decoder = new TextDecoder('latin1');
    const raw = decoder.decode(new Uint8Array(buf));
    if (raw.includes('word/document.xml')) {
      const tRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let m, text = '';
      while ((m = tRe.exec(raw)) !== null) text += m[1] + ' ';
      if (text.trim().length > 20) return text.trim();
    }
    return '';
  } catch {
    return '';
  }
}