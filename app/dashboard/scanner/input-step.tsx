'use client';

import { useRef, useState } from 'react';
import {
  Upload, FileVideo, FileAudio, Mic, X, Loader2,
  Video, AudioLines, Radio, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type InputMode = 'video' | 'audio' | 'live';

export const MAX_MEDIA_BYTES = 1024 * 1024 * 1024; // 1 GB

const VIDEO_ACCEPT = '.mp4,.mov,.webm,.avi,.mkv,video/*';
const AUDIO_ACCEPT = '.mp3,.wav,.m4a,.aac,.ogg,.flac,audio/*';

export type InputSelection = {
  mode: InputMode;
  file: File | null;
  filename: string;
  durationS: number | null;
};

export function InputStep({ onContinue }: { onContinue: (sel: InputSelection) => void }) {
  const [mode, setMode] = useState<InputMode | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [durationS, setDurationS] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [reading, setReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = mode === 'video' ? VIDEO_ACCEPT : AUDIO_ACCEPT;

  function pickMode(m: InputMode) {
    setMode(m);
    setFile(null);
    setDurationS(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleFile(f: File) {
    if (f.size > MAX_MEDIA_BYTES) {
      toast.error('File too large', { description: 'Maximum file size is 1 GB.' });
      return;
    }
    const name = f.name.toLowerCase();
    if (mode === 'video' && !f.type.startsWith('video/') && !/\.(mp4|mov|webm|avi|mkv)$/.test(name)) {
      toast.error('Unsupported video format', { description: 'Use MP4, MOV, WebM, AVI, or MKV.' });
      return;
    }
    if (mode === 'audio' && !f.type.startsWith('audio/') && !/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(name)) {
      toast.error('Unsupported audio format', { description: 'Use MP3, WAV, M4A, AAC, OGG, or FLAC.' });
      return;
    }
    setReading(true);
    try {
      const dur = await getDuration(f);
      setDurationS(dur);
      setFile(f);
    } catch {
      setFile(f);
      setDurationS(null);
    } finally {
      setReading(false);
    }
  }

  function handleContinue() {
    if (!mode) {
      toast.error('Select an input type', { description: 'Choose video upload, audio upload, or live recording.' });
      return;
    }
    if (mode !== 'live' && !file) {
      toast.error('Upload a file', { description: 'Drag & drop or browse to select a file.' });
      return;
    }
    onContinue({
      mode,
      file,
      filename: file?.name ?? 'Live Recording',
      durationS,
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {([
          { m: 'video' as InputMode, icon: FileVideo, label: 'Upload Video', desc: 'MP4, MOV, WebM up to 1 GB' },
          { m: 'audio' as InputMode, icon: FileAudio, label: 'Upload Audio', desc: 'MP3, WAV, M4A up to 1 GB' },
          { m: 'live' as InputMode, icon: Mic, label: 'Live Recording', desc: 'Speak into your microphone' },
        ]).map(({ m, icon: Icon, label, desc }) => (
          <button
            key={m}
            onClick={() => pickMode(m)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-200',
              mode === m
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30',
            )}
          >
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', mode === m ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-foreground">{label}</span>
            <span className="text-xs text-muted-foreground">{desc}</span>
          </button>
        ))}
      </div>

      {mode && mode !== 'live' && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">{mode === 'video' ? 'Upload your video file' : 'Upload your audio file'}</CardTitle>
            <CardDescription>{mode === 'video' ? 'MP4, MOV, WebM, AVI, MKV' : 'MP3, WAV, M4A, AAC, OGG, FLAC'} · up to 1 GB</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
                dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-muted-foreground/50',
              )}
            >
              {reading ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <Upload className="h-7 w-7 text-muted-foreground" />}
              <p className="mt-2 text-sm font-medium text-foreground">{reading ? 'Reading file…' : 'Drag & drop or browse'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{mode === 'video' ? 'Video' : 'Audio'} · up to 1 GB</p>
              <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <Button variant="outline" size="sm" className="mt-3" onClick={() => inputRef.current?.click()} disabled={reading}>
                Browse files
              </Button>
            </div>
            {file && (
              <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  {mode === 'video' ? <Video className="h-4 w-4 shrink-0 text-muted-foreground" /> : <AudioLines className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(file.size)}{durationS != null && ` · ${formatDuration(durationS)}`}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setFile(null); setDurationS(null); if (inputRef.current) inputRef.current.value = ''; }} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === 'live' && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Live microphone recording</CardTitle>
            <CardDescription>Click continue to start live speech recognition via your browser&rsquo;s Web Speech API.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-accent/30 bg-accent/10 p-3 text-xs text-accent-foreground">
              <Radio className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>Live transcription uses your browser&rsquo;s built-in speech engine (Chrome/Edge). Audio is processed by the browser service and is not sent to our servers.</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mic className="h-4 w-4" />
              <span>Requires microphone permission. Best with a quiet environment and a good microphone.</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>All processing happens in your browser. No media bytes are stored or uploaded.</span>
        </div>
        <Button onClick={handleContinue} disabled={!mode || (mode !== 'live' && !file)}>
          Continue
          <Upload className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

async function getDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      if (file.type.startsWith('video/')) {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration); };
        v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        v.src = url;
      } else {
        const a = document.createElement('audio');
        a.preload = 'metadata';
        a.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(a.duration); };
        a.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        a.src = url;
      }
    } catch {
      resolve(null);
    }
  });
}