'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, Mic, Square, FileAudio, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { transcribeAudio, type TranscriptSegment, type TranscribeProgress } from '@/lib/transcribe';
import { isSpeechSupported, startSpeech, type SpeechSession } from '@/lib/speech';
import type { InputSelection } from './input-step';

export type ExtractionResult = {
  segments: TranscriptSegment[];
  mode: 'video' | 'audio' | 'live';
};

export function ExtractStep({
  input,
  onContinue,
  onBack,
}: {
  input: InputSelection;
  onContinue: (result: ExtractionResult) => void;
  onBack: () => void;
}) {
  const isLive = input.mode === 'live';
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [done, setDone] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);

  // Live recording state
  const [listening, setListening] = useState(false);
  const [liveSegments, setLiveSegments] = useState<TranscriptSegment[]>([]);
  const [partial, setPartial] = useState('');
  const speechRef = useRef<SpeechSession | null>(null);
  const liveStartRef = useRef<number>(0);
  const startedRef = useRef(false);

  const runTranscription = useCallback(async () => {
    if (!input.file) {
      setError('No file selected. Go back and choose a file.');
      return;
    }
    setTranscribing(true);
    setError(null);
    setProgress(0);
    setLabel('Loading speech recognition model…');
    try {
      const onProgress: TranscribeProgress = (pct, lbl) => {
        setProgress(pct);
        setLabel(lbl);
      };
      const segs = await transcribeAudio(input.file, onProgress, true);
      setSegments(segs);
      setProgress(100);
      setLabel('Transcription complete');
      setDone(true);
      setTranscribing(false);
      if (segs.length === 0 || segs.every((s) => !s.text)) {
        setError('No speech detected. The file may be silent, instrumental, or in an unsupported language. You can go back and try a different file, or type manually in the transcript editor.');
      }
    } catch (err) {
      setTranscribing(false);
      setError(err instanceof Error ? err.message : 'Transcription failed. The file may be corrupted or in an unsupported format.');
    }
  }, [input.file]);

  // Start file transcription once on mount (not in render body)
  useEffect(() => {
    if (!isLive && !startedRef.current) {
      startedRef.current = true;
      void runTranscription();
    }
    return () => {
      speechRef.current?.stop();
      speechRef.current = null;
    };
  }, [isLive, runTranscription]);

  function toggleLive() {
    if (listening) {
      speechRef.current?.stop();
      speechRef.current = null;
      setListening(false);
      setPartial('');
      return;
    }
    if (!isSpeechSupported()) {
      toast.error('Live speech not supported', { description: 'Use Chrome or Edge for live transcription.' });
      return;
    }
    setLiveSegments([]);
    setDone(false);
    const session = startSpeech('en', {
      onStart: () => { setListening(true); liveStartRef.current = Date.now(); },
      onPartial: (t) => setPartial(t),
      onFinal: (t, ts) => {
        const seg: TranscriptSegment = {
          id: `live-${Date.now()}`,
          start: ts ?? (Date.now() - liveStartRef.current) / 1000,
          end: (ts ?? 0) + 1,
          text: t,
        };
        setLiveSegments((prev) => [...prev, seg]);
        setPartial('');
      },
      onError: (err) => {
        setListening(false);
        speechRef.current = null;
        setPartial('');
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          toast.error('Microphone blocked', { description: 'Allow microphone access in your browser settings.' });
        } else if (err === 'no-speech') {
          toast.info('No speech detected', { description: 'Try speaking closer to the microphone.' });
        } else {
          toast.error('Transcription error', { description: err });
        }
      },
      onEnd: () => { setListening(false); speechRef.current = null; setPartial(''); },
    });
    if (session) speechRef.current = session;
  }

  function stopLive() {
    speechRef.current?.stop();
    speechRef.current = null;
    setListening(false);
    setPartial('');
    if (liveSegments.length > 0) setDone(true);
  }

  function handleContinue() {
    if (isLive) {
      if (liveSegments.length === 0) {
        toast.error('Nothing to continue with', { description: 'Record some speech first.' });
        return;
      }
      onContinue({ segments: liveSegments, mode: 'live' });
    } else {
      if (segments.length === 0 || error) {
        toast.error('No transcript', { description: 'Transcription has not completed yet.' });
        return;
      }
      onContinue({ segments, mode: input.mode });
    }
  }

  const showProgress = isLive ? false : (transcribing || (!done && !error));
  const canContinue = isLive ? liveSegments.length > 0 : (done && !error);

  return (
    <div className="space-y-5">
      {!isLive && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileAudio className="h-4 w-4" />
              Transcribing {input.filename}
            </CardTitle>
            <CardDescription>
              {input.durationS != null && `${formatDuration(input.durationS)} of audio · `}
              Running Whisper speech recognition in your browser. This may take a few minutes for long files.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {showProgress && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-muted-foreground">{label}</span>
                  <span className="ml-auto font-medium text-foreground">{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            {done && !error && (
              <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div>
                  <p className="text-sm font-medium text-foreground">Transcription complete</p>
                  <p className="text-xs text-muted-foreground">{segments.length} segments detected. Review the transcript in the next step.</p>
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-foreground">Transcription failed</p>
                  <p className="text-xs text-muted-foreground">{error}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isLive && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mic className={cn('h-4 w-4', listening && 'text-destructive')} />
              {listening ? 'Listening…' : 'Ready to record'}
            </CardTitle>
            <CardDescription>Speak into your microphone. Recognized speech appears below in real time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant={listening ? 'destructive' : 'default'} size="sm" onClick={toggleLive}>
                {listening ? <Square className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                {listening ? 'Stop' : 'Start recording'}
              </Button>
              {listening && (
                <Badge variant="outline" className="text-destructive border-destructive/40">
                  <span className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-destructive" /> Live
                </Badge>
              )}
              {!isSpeechSupported() && (
                <Badge variant="outline" className="text-muted-foreground">Not supported in this browser</Badge>
              )}
            </div>

            {partial && (
              <p className="rounded-md bg-muted/40 p-2 text-sm italic text-muted-foreground">{partial}…</p>
            )}

            {liveSegments.length > 0 && (
              <div className="max-h-64 space-y-1.5 overflow-y-auto scrollbar-thin rounded-md border border-border/60 p-3">
                {liveSegments.map((seg) => (
                  <div key={seg.id} className="flex gap-2 text-sm">
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatTime(seg.start)}</span>
                    <span className="text-foreground">{seg.text}</span>
                  </div>
                ))}
              </div>
            )}

            {done && (
              <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="text-sm text-foreground">{liveSegments.length} segments captured. Continue to review.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>Back</Button>
        <div className="flex items-center gap-2">
          {isLive && listening && (
            <Button variant="outline" size="sm" onClick={stopLive}>
              Stop &amp; finish
            </Button>
          )}
          <Button onClick={handleContinue} disabled={!canContinue}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatTime(s: number): string {
  if (!s) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}