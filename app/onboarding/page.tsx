'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ScanLine, Eye, FileLock2, ArrowRight, ArrowLeft, Check, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LANGUAGES, LanguageCode } from '@/lib/i18n';
import { useLang } from '@/components/providers';

const STEPS = [
  {
    icon: ShieldCheck,
    title: 'Welcome to PRIVASEC AI',
    body: 'An AI-powered privacy protection platform that helps you detect and protect personal information before sharing digital content. Let’s take a quick tour.',
  },
  {
    icon: ScanLine,
    title: 'What it detects',
    body: 'Emails, phone numbers, credit cards, bank accounts, government IDs, passport numbers, API keys, tokens, IP addresses, GPS coordinates, addresses, license plates, dates of birth, and person names — with contextual confidence.',
  },
  {
    icon: Eye,
    title: 'Explainable AI',
    body: 'Every finding is explained: why it’s sensitive, what exposure could mean, and what action we recommend. We distinguish between observed findings, potential consequences, and confirmed incidents.',
  },
  {
    icon: FileLock2,
    title: 'How protection works',
    body: 'Choose to mask (partially hide) or permanently redact findings. We re-scan the protected output to verify findings are gone before you export. Original uploads are not retained by default.',
  },
  {
    icon: Sparkles,
    title: 'You’re ready',
    body: 'Try a sample analysis right from your dashboard, or upload your own content. You can restart this tour anytime from Learn & Help Center.',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { setLang } = useLang();
  const [step, setStep] = useState(0);
  const [pickedLang, setPickedLang] = useState<LanguageCode>('en');
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace('/signin');
  }, [loading, session, router]);

  async function finish() {
    if (!session) return;
    setFinishing(true);
    setLang(pickedLang);
    await supabase.from('user_profiles').update({
      preferred_language: pickedLang,
      onboarding_completed: true,
    }).eq('id', session.user.id);
    router.replace('/dashboard');
  }

  if (loading || !session) return null;
  const StepIcon = STEPS[step].icon;
  const isLast = step === STEPS.length - 1;
  const isLangStep = step === 0;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-accent/10 via-background to-background" />
      <div className="absolute -top-32 left-1/2 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
      <div className="w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={30} />
        </div>

        <Card className="border-border/60 shadow-lg animate-fade-in">
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <StepIcon className="h-7 w-7" />
              </div>
            </div>
            <h2 className="mt-5 text-center font-display text-2xl font-bold text-foreground">{STEPS[step].title}</h2>
            <p className="mt-3 text-center text-muted-foreground text-balance">{STEPS[step].body}</p>

            {isLangStep && (
              <div className="mt-6">
                <p className="mb-2 text-center text-sm font-medium text-foreground">Choose your preferred language</p>
                <div className="grid max-h-44 grid-cols-2 gap-2 overflow-y-auto scrollbar-thin rounded-md border border-border p-2 sm:grid-cols-3">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setPickedLang(l.code)}
                      className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        pickedLang === l.code
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/40 text-foreground hover:bg-muted'
                      }`}
                    >
                      {l.nativeName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => router.replace('/dashboard')} disabled={finishing}>
                Skip tour
              </Button>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)} disabled={finishing}>
                    <ArrowLeft className="mr-1 h-4 w-4" /> Back
                  </Button>
                )}
                {isLast ? (
                  <Button size="sm" onClick={finish} disabled={finishing}>
                    <Check className="mr-1 h-4 w-4" /> Finish
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setStep((s) => s + 1)} disabled={finishing}>
                    Next <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-accent' : 'w-1.5 bg-muted-foreground/30'}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}