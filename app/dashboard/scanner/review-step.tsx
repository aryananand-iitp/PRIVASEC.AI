'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Pencil, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import type { TranscriptSegment } from '@/lib/transcribe';

export function ReviewStep({
  segments,
  onContinue,
  onBack,
}: {
  segments: TranscriptSegment[];
  onContinue: (segments: TranscriptSegment[]) => void;
  onBack: () => void;
}) {
  const [edited, setEdited] = useState<TranscriptSegment[]>(() => segments.map((s) => ({ ...s })));
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setEdited(segments.map((s) => ({ ...s })));
    setConfirmed(false);
  }, [segments]);

  const totalText = edited.map((s) => s.text).join(' ').trim();

  function updateSegment(id: string, text: string) {
    setEdited((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
    setConfirmed(false);
  }

  function addSegment() {
    const id = `manual-${Date.now()}`;
    setEdited((prev) => [...prev, { id, start: 0, end: 0, text: '' }]);
    setConfirmed(false);
  }

  function removeSegment(id: string) {
    setEdited((prev) => prev.filter((s) => s.id !== id));
    setConfirmed(false);
  }

  function handleContinue() {
    const hasText = edited.some((s) => s.text.trim());
    if (!hasText) {
      toast.error('Transcript is empty', { description: 'Add or correct at least one segment before continuing.' });
      return;
    }
    onContinue(edited);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Review & Edit Transcript</h3>
          <p className="text-sm text-muted-foreground">Correct any transcription errors before scanning for personal information.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{edited.length} segments</span>
          <span>·</span>
          <span>{totalText.length.toLocaleString()} characters</span>
        </div>
      </div>

      {edited.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-10 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">No transcript segments</p>
          <p className="mt-1 text-xs text-muted-foreground">You can type a transcript manually below.</p>
        </div>
      )}

      <div className="max-h-[420px] space-y-2 overflow-y-auto scrollbar-thin">
        {edited.map((seg, idx) => (
          <div key={seg.id} className="rounded-lg border border-border/60 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {formatTime(seg.start)}
                </span>
                <span className="text-xs text-muted-foreground">Segment {idx + 1}</span>
              </div>
              <button onClick={() => removeSegment(seg.id)} className="text-xs text-muted-foreground hover:text-destructive">
                Remove
              </button>
            </div>
            <textarea
              value={seg.text}
              onChange={(e) => updateSegment(seg.id, e.target.value)}
              placeholder="Type or correct text…"
              className="min-h-[48px] w-full resize-y rounded-md border border-input bg-background p-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={addSegment}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Add segment
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent/10 p-3 text-xs text-accent-foreground">
        <Pencil className="h-4 w-4 shrink-0" />
        <span>Edit any segment above, then confirm. You cannot scan an empty or unconfirmed transcript.</span>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>Back</Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmed(true)}
            disabled={!totalText}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Confirm transcript
          </Button>
          <Button onClick={handleContinue} disabled={!confirmed || !totalText}>
            Confirm &amp; Continue
          </Button>
        </div>
      </div>
      {!confirmed && totalText && (
        <p className="text-right text-xs text-muted-foreground">Click &ldquo;Confirm transcript&rdquo; first to enable scanning.</p>
      )}
    </div>
  );
}

function formatTime(s: number): string {
  if (!s) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}