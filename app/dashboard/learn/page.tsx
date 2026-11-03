'use client';

import { useState } from 'react';
import { Search, BookOpen, ChevronDown, ChevronRight, GraduationCap, LifeBuoy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TOPICS: { id: string; title: string; body: string; category: string }[] = [
  { id: 'getting-started', category: 'Getting Started', title: 'Getting Started with PRIVASEC AI', body: 'Sign in, then go to Analyze Content. Paste text or upload an image/PDF. Click Analyze to detect personal information. Review findings in the Threat Center, then protect what you choose and export the protected version.' },
  { id: 'how-to-analyze', category: 'Getting Started', title: 'How to Analyze Content', body: 'Choose a content type, drag a file or paste text, and click Analyze. For images and scanned PDFs, OCR runs in your browser to extract text before PII detection. For video/audio, paste a transcript instead.' },
  { id: 'understanding-risks', category: 'Understanding Risks', title: 'Understanding Privacy Risks', body: 'Each finding has a severity (low/medium/high/critical) based on the type of information and how easily it could be misused. The overall risk score (0-100) combines all findings. Critical findings like credit cards and API keys should always be redacted before sharing.' },
  { id: 'confidence', category: 'Understanding Risks', title: 'Understanding Detection Confidence', body: 'Confidence (0-100%) reflects how certain the detection engine is that a match is real PII. High confidence means the pattern matched strongly. Low confidence may need manual review.' },
  { id: 'redaction', category: 'Protection', title: 'How Automatic Redaction Works', body: 'Redaction replaces the sensitive value with [REDACTED] in the exported text. Masking partially hides it (e.g. arn****@email.com). After applying, we re-scan the output to verify the findings are gone — this is post-redaction verification.' },
  { id: 'pdf-guide', category: 'Protection', title: 'PDF Protection Guide', body: 'Upload a PDF. If it has embedded text, we extract it directly. If it is scanned, OCR runs on each page. After detection, choose redact or mask, select findings, and apply.' },
  { id: 'image-guide', category: 'Protection', title: 'Image Protection Guide', body: 'Upload a JPG/PNG/WEBP image. OCR extracts any visible text. After PII detection, you can mask or redact the text values in the exported output.' },
  { id: 'video-guide', category: 'Protection', title: 'Video Protection Guide', body: 'Video frame extraction requires server-side FFmpeg not available here. For video content, transcribe the spoken text and paste it as a text analysis. Subtitle files (SRT/VTT) can be uploaded directly.' },
  { id: 'metadata-guide', category: 'Protection', title: 'Metadata Security Guide', body: 'Photos and documents often contain hidden metadata: GPS coordinates, camera model, author name, creation dates. We recommend removing EXIF data before sharing photos.' },
  { id: 'faq', category: 'Support', title: 'Frequently Asked Questions', body: 'Q: Is my data sent to a server? A: No — text detection and image OCR run entirely in your browser. Q: Are original files stored? A: No. Q: Can I delete my history? A: Yes, from Analysis History.' },
  { id: 'troubleshooting', category: 'Support', title: 'Troubleshooting', body: 'If OCR fails, ensure the image is clear and high-resolution. If no text is detected in a PDF, it may be purely graphical. If analysis is slow, the content may be very long — we cap at 500,000 characters.' },
  { id: 'glossary', category: 'Reference', title: 'Privacy Glossary', body: 'PII: Personally Identifiable Information. OCR: Optical Character Recognition. RLS: Row-Level Security. JWT: JSON Web Token. NER: Named Entity Recognition.' },
];

const CATEGORIES = ['All', 'Getting Started', 'Understanding Risks', 'Protection', 'Support', 'Reference'];

export default function LearnPage() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [category, setCategory] = useState('All');

  const filtered = TOPICS.filter((t) => {
    if (category !== 'All' && t.category !== category) return false;
    if (query) { const q = query.toLowerCase(); if (!t.title.toLowerCase().includes(q) && !t.body.toLowerCase().includes(q)) return false; }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Learn & Help Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">Understand privacy risks, how detection works, and how to protect your content.</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search help articles…" className="pl-9" />
      </div>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={cn('rounded-full px-3 py-1.5 text-sm font-medium transition-colors', category === c ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-muted')}>{c}</button>
        ))}
      </div>
      <div className="grid gap-3">
        {filtered.length === 0 ? <Card className="border-border/60"><CardContent className="py-10 text-center text-sm text-muted-foreground">No articles match your search.</CardContent></Card> : filtered.map((t) => (
          <Card key={t.id} className="border-border/60">
            <button onClick={() => setExpanded(expanded === t.id ? null : t.id)} className="w-full p-4 text-left">
              <div className="flex items-start justify-between gap-2">
                <div><Badge variant="secondary" className="mb-1.5 text-xs">{t.category}</Badge><p className="text-sm font-medium text-foreground">{t.title}</p></div>
                {expanded === t.id ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </div>
              {expanded === t.id && <p className="mt-3 text-sm text-muted-foreground">{t.body}</p>}
            </button>
          </Card>
        ))}
      </div>
      <Card className="border-border/60">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div><p className="text-sm font-medium text-foreground">Still need help?</p><p className="text-xs text-muted-foreground">Restart the onboarding tour anytime.</p></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><a href="/onboarding"><GraduationCap className="mr-2 h-4 w-4" /> Restart tour</a></Button>
            <Button variant="outline" size="sm" asChild><a href="/dashboard/about"><BookOpen className="mr-2 h-4 w-4" /> About</a></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}