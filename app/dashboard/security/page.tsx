'use client';

import { useState, useEffect } from 'react';
import { Shield, Lock, Eye, FileLock2, Server, Clock, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/components/providers';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SecurityPage() {
  const { session } = useAuth();
  const [sessionCount, setSessionCount] = useState(0);
  const [lastLogin, setLastLogin] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!session) return;
      const { data } = await supabase.from('user_sessions').select('logged_in_at').eq('user_id', session.user.id).order('logged_in_at', { ascending: false }).limit(5);
      setSessionCount(data?.length ?? 0);
      if (data && data.length > 0) setLastLogin(data[0].logged_in_at);
    })();
  }, [session]);

  async function logSession() {
    if (!session) return;
    await supabase.from('user_sessions').insert({ user_id: session.user.id });
    await supabase.from('activity').insert({ user_id: session.user.id, event: 'security_review' });
    setSessionCount((c) => c + 1);
    setLastLogin(new Date().toISOString());
    toast.success('Session logged');
  }

  const principles = [
    { icon: Lock, title: 'Secure authentication', body: 'Supabase Auth with email/password. Sessions managed with JWT tokens and automatic refresh.' },
    { icon: Eye, title: 'Row-level security', body: 'Every database table uses RLS policies. You can only access your own data.' },
    { icon: FileLock2, title: 'No original file retention', body: 'File bytes are processed in your browser memory and never stored by default.' },
    { icon: Server, title: 'On-device processing', body: 'Text PII detection and image OCR (Tesseract.js) run entirely in your browser.' },
    { icon: Clock, title: 'Configurable retention', body: 'Choose how long your analysis history is kept in Settings.' },
    { icon: Trash2, title: 'You control your data', body: 'Delete any analysis or notification at any time. Account deletion removes all data.' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Security & Privacy</h1>
        <p className="mt-1 text-sm text-muted-foreground">How we protect your data and what you control.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[{ icon: Shield, label: 'Authentication', value: 'Supabase Auth (JWT)' }, { icon: Lock, label: 'RLS enabled', value: 'All tables' }, { icon: FileLock2, label: 'File retention', value: 'None (by default)' }].map((s) => (
          <Card key={s.label} className="border-border/60"><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-medium text-muted-foreground">{s.label}</p><p className="mt-1 text-sm font-semibold text-foreground">{s.value}</p></div><s.icon className="h-8 w-8 text-primary" /></CardContent></Card>
        ))}
      </div>
      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-lg">Session activity</CardTitle><CardDescription>Recent login sessions for your account.</CardDescription></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="text-muted-foreground">Recent sessions: <span className="font-medium text-foreground">{sessionCount}</span></p>
              {lastLogin && <p className="text-muted-foreground">Last login: <span className="font-medium text-foreground">{new Date(lastLogin).toLocaleString()}</span></p>}
            </div>
            <Button variant="outline" size="sm" onClick={logSession}>Log this session</Button>
          </div>
        </CardContent>
      </Card>
      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-lg">Privacy principles</CardTitle><CardDescription>Our privacy-first approach to your data.</CardDescription></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {principles.map((p) => (
              <div key={p.title} className="flex gap-3 rounded-md border border-border/40 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><p.icon className="h-4 w-4" /></div>
                <div><p className="text-sm font-medium text-foreground">{p.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{p.body}</p></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-lg">Limitations</CardTitle><CardDescription>What we can and cannot guarantee.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><p className="text-muted-foreground">Detection is pattern-based and may miss some personal information or flag false positives. Always review manually.</p></div>
          <div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><p className="text-muted-foreground">OCR quality depends on image resolution and text clarity. Handwritten or low-res text may not be detected.</p></div>
          <div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><p className="text-muted-foreground">Video frame analysis and audio transcription are not available in this environment. Use transcripts instead.</p></div>
          <div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /><p className="text-muted-foreground">We never claim absolute safety. Risk scores are estimates, not guarantees.</p></div>
          <div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /><p className="text-muted-foreground">We do not make compliance certifications. This is a detection tool, not a compliance platform.</p></div>
        </CardContent>
      </Card>
    </div>
  );
}