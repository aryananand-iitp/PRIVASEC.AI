import Link from 'next/link';
import { ShieldCheck, ScanLine, Eye, FileLock2, ArrowRight, CheckCircle2, Globe, Lock, Gauge } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#how" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              How it works
            </Link>
            <Link href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-accent/10 via-background to-background" />
        <div className="absolute -top-24 right-0 -z-10 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div className="animate-slide-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                Protect Your Privacy Before You Publish
              </div>
              <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl text-balance">
                Detect. Understand.{' '}
                <span className="text-accent">Protect.</span>
              </h1>
              <p className="mt-5 max-w-lg text-lg text-muted-foreground text-balance">
                PRIVASEC AI scans your text, documents, and media for personal information, explains exactly
                why each finding is sensitive, and helps you redact it before you share.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="h-12 px-7 text-base">
                  <Link href="/signup">
                    Start protecting content
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 px-7 text-base">
                  <Link href="/signin">Sign in</Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent" /> Real detection</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent" /> Explainable AI</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent" /> Verified redaction</span>
              </div>
            </div>

            <div className="relative animate-fade-in">
              <Card className="overflow-hidden border-border/60 shadow-xl">
                <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
                  <div className="h-3 w-3 rounded-full bg-destructive/60" />
                  <div className="h-3 w-3 rounded-full bg-warning/60" />
                  <div className="h-3 w-3 rounded-full bg-accent/60" />
                  <span className="ml-3 text-xs text-muted-foreground">analysis · sample-document.txt</span>
                </div>
                <CardContent className="space-y-3 p-5 text-sm">
                  <p className="font-mono text-xs leading-relaxed text-muted-foreground">
                    Hi, my name is <span className="rounded bg-warning/20 px-1 text-warning-foreground">Dr Arnav Mehta</span>. Contact me at{' '}
                    <span className="rounded bg-destructive/20 px-1 text-destructive-foreground">arn****@privasec.ai</span> or{' '}
                    <span className="rounded bg-destructive/20 px-1 text-destructive-foreground">+91 98*** 123**</span>.
                  </p>
                  <p className="font-mono text-xs leading-relaxed text-muted-foreground">
                    Card <span className="rounded bg-destructive/20 px-1 text-destructive-foreground">**** **** **** 4242</span> ·
                    API key <span className="rounded bg-destructive/20 px-1 text-destructive-foreground">sk_live********</span>.
                  </p>
                  <div className="flex items-center justify-between rounded-lg bg-secondary/10 p-3">
                    <div>
                      <p className="text-xs font-medium text-secondary-foreground">Privacy Risk Score</p>
                      <p className="text-2xl font-bold text-secondary">82 <span className="text-xs font-normal text-muted-foreground">/ 100</span></p>
                    </div>
                    <div className="rounded-full bg-destructive/15 px-3 py-1 text-xs font-semibold text-destructive">Critical</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl text-balance">
              Privacy intelligence, explained in plain language
            </h2>
            <p className="mt-4 text-muted-foreground text-balance">
              Every detection comes with a clear explanation of why it matters, what could go wrong,
              and exactly how to fix it.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { icon: ScanLine, title: 'Detect personal information', body: 'Emails, phone numbers, card numbers, IDs, tokens, GPS, addresses, names — across text, images, PDFs, subtitles, and metadata.' },
              { icon: Eye, title: 'Understand the risk', body: 'Each finding is explained: why it is sensitive, what exposure could mean, and what action is recommended. No exaggeration.' },
              { icon: FileLock2, title: 'Protect before sharing', body: 'Mask or permanently redact findings, verify the result is clean, and export a protected version plus a full report.' },
            ].map((f) => (
              <Card key={f.title} className="border-border/60 transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-t border-border/60 bg-secondary/5 py-14">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 md:grid-cols-4">
          {[
            { icon: ScanLine, stat: '15+', label: 'Detection categories' },
            { icon: Globe, stat: '17', label: 'Interface languages' },
            { icon: Lock, stat: 'RLS-secured', label: 'Your data is yours' },
            { icon: Gauge, stat: '0–100', label: 'Privacy risk score' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <s.icon className="mx-auto h-6 w-6 text-accent" />
              <p className="mt-3 font-display text-2xl font-bold text-foreground">{s.stat}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl text-balance">
              How it works
            </h2>
            <p className="mt-4 text-muted-foreground text-balance">From upload to protected export in five steps.</p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-5">
            {[
              { step: '01', title: 'Sign in securely', body: 'Create an account with email and password. Your data is protected by row-level security.' },
              { step: '02', title: 'Upload or paste', body: 'Drop a file or paste text. We support text, images, PDFs, video, audio, subtitles, and metadata.' },
              { step: '03', title: 'AI scans content', body: 'Our detection engine finds personal information using regex, validation, and contextual heuristics.' },
              { step: '04', title: 'Understand & protect', body: 'Review each finding with its risk explanation. Mask or redact what you choose to remove.' },
              { step: '05', title: 'Verify & export', body: 'We re-scan the protected output to confirm findings are gone, then export the file and report.' },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div className="font-display text-sm font-bold text-accent">{s.step}</div>
                <h3 className="mt-2 font-display text-base font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="border-t border-border/60 bg-secondary/5 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl text-balance">
            What is PRIVASEC AI?
          </h2>
          <p className="mt-6 text-lg text-muted-foreground text-balance">
            PRIVASEC AI is an AI-powered privacy protection platform that helps people detect and protect
            personal information before sharing digital content.
          </p>
          <p className="mt-4 text-muted-foreground text-balance">
            Our mission is to make digital privacy understandable and accessible to everyone, and to build a
            safer digital environment where people can share content with greater privacy awareness.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">Create your account</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/signin">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <Logo />
          <p className="text-sm text-muted-foreground">Detect. Understand. Protect.</p>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} PRIVASEC AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
