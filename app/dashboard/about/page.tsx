'use client';

import { ShieldCheck, ScanLine, Eye, FileLock2, Target, Sparkles, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">About PRIVASEC AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">Detect. Understand. Protect.</p>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-6">
          <p className="text-lg text-foreground text-balance">
            PRIVASEC AI is an AI-powered privacy protection platform that helps people detect and protect personal information before sharing digital content.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Our Mission</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Make digital privacy understandable and accessible to everyone.</p></CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" /> Our Vision</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Build a safer digital environment where people can share content with greater privacy awareness.</p></CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-lg">What we do</CardTitle><CardDescription>Our technology and capabilities.</CardDescription></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: ScanLine, title: 'Detect', body: 'PII detection using regex, validation, contextual heuristics, and OCR (Tesseract.js) for images and scanned PDFs.' },
              { icon: Eye, title: 'Explain', body: 'Every finding comes with a clear explanation of why it matters, what exposure could mean, and what action we recommend.' },
              { icon: FileLock2, title: 'Protect', body: 'Mask or permanently redact findings, verify the output is clean, and export the protected version.' },
            ].map((f) => (
              <div key={f.title} className="rounded-md border border-border/40 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></div>
                <p className="mt-3 text-sm font-medium text-foreground">{f.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-lg">Privacy-first approach</CardTitle><CardDescription>How we handle your data.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /><p className="text-muted-foreground">All text detection and image OCR runs entirely in your browser. File bytes never leave your device.</p></div>
          <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /><p className="text-muted-foreground">Row-level security on every database table — you can only access your own data.</p></div>
          <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /><p className="text-muted-foreground">Original file bytes are never stored. Only pasted text is kept so you can review history.</p></div>
          <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /><p className="text-muted-foreground">We never use your content to train AI models.</p></div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-lg">Limitations</CardTitle><CardDescription>What we cannot do.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><p className="text-muted-foreground">Video frame analysis requires server-side services not available in this environment. Live speech-to-text is supported via the browser's Web Speech API (Chrome/Edge).</p></div>
          <div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><p className="text-muted-foreground">Face detection, bounding-box visualization, and on-image blurring are not available here.</p></div>
          <div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><p className="text-muted-foreground">We do not make compliance certifications (GDPR, HIPAA, etc.). This is a detection tool.</p></div>
          <div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><p className="text-muted-foreground">OCR supports English text. Other languages may produce lower-quality results.</p></div>
        </CardContent>
      </Card>
    </div>
  );
}