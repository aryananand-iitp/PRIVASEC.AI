'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Sun, Moon, Monitor, Eye, Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/components/providers';
import { supabase, type PreferenceRow } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { session } = useAuth();
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState<PreferenceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retention, setRetention] = useState(30);
  const [aiConsent, setAiConsent] = useState(false);

  useEffect(() => {
    (async () => {
      if (!session) return;
      const { data } = await supabase.from('preferences').select('*').eq('user_id', session.user.id).maybeSingle();
      const p = data as PreferenceRow | null;
      setPrefs(p);
      if (p) { setRetention(p.retention_days); setAiConsent(p.third_party_ai_consent); if (p.theme && p.theme !== 'system') setTheme(p.theme); }
      setLoading(false);
    })();
  }, [session, setTheme]);

  async function save() {
    if (!session) return;
    setSaving(true);
    const { error } = await supabase.from('preferences').upsert({
      user_id: session.user.id,
      theme: (theme as 'light' | 'dark' | 'system') ?? 'system',
      retention_days: retention,
      third_party_ai_consent: aiConsent,
      hidden_widgets: prefs?.hidden_widgets ?? [],
    });
    setSaving(false);
    if (error) toast.error('Could not save', { description: error.message });
    else toast.success('Settings saved');
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Customize your experience and data retention.</p>
      </div>
      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-lg">Appearance</CardTitle><CardDescription>Choose light, dark, or system theme.</CardDescription></CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {[{ value: 'light', icon: Sun, label: 'Light' }, { value: 'dark', icon: Moon, label: 'Dark' }, { value: 'system', icon: Monitor, label: 'System' }].map((opt) => (
              <button key={opt.value} onClick={() => setTheme(opt.value)} className={`flex flex-1 flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${theme === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
                <opt.icon className="h-5 w-5 text-foreground" /><span className="text-sm font-medium text-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-lg">Data retention</CardTitle><CardDescription>How long to keep your analysis history.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Retention period</Label>
            <Select value={String(retention)} onValueChange={(v) => setRetention(Number(v))}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="7">7 days</SelectItem><SelectItem value="14">14 days</SelectItem><SelectItem value="30">30 days</SelectItem><SelectItem value="90">90 days</SelectItem><SelectItem value="365">1 year</SelectItem></SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Analyses older than this may be removed automatically. Original file bytes are never stored.</p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-lg">Third-party AI consent</CardTitle><CardDescription>Control whether your content can be sent to external AI services.</CardDescription></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="consent" className="flex items-center gap-2"><Eye className="h-4 w-4" /> Allow third-party AI processing</Label>
              <p className="text-xs text-muted-foreground">Off by default. We never use your data to train AI models.</p>
            </div>
            <Switch id="consent" checked={aiConsent} onCheckedChange={setAiConsent} />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end"><Button onClick={save} disabled={saving}><SettingsIcon className="mr-2 h-4 w-4" /> {saving ? 'Saving…' : 'Save settings'}</Button></div>
    </div>
  );
}