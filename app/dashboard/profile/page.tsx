'use client';

import { useState, useEffect } from 'react';
import { Shield, Mail, Calendar, Globe, Clock, Loader2 } from 'lucide-react';
import { useAuth, useLang } from '@/components/providers';
import { supabase, type ProfileRow } from '@/lib/supabase';
import { LANGUAGES, LanguageCode } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { session } = useAuth();
  const { setLang } = useLang();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [preferredLang, setPreferredLang] = useState<LanguageCode>('en');
  const [timezone, setTimezone] = useState('UTC');
  const [activity, setActivity] = useState<{ event: string; detail: string | null; created_at: string }[]>([]);

  useEffect(() => {
    (async () => {
      if (!session) return;
      const [{ data: p }, { data: act }] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', session.user.id).maybeSingle(),
        supabase.from('activity').select('event, detail, created_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(10),
      ]);
      const pr = p as ProfileRow | null;
      setProfile(pr);
      if (pr) { setFullName(pr.full_name ?? ''); setPreferredLang(pr.preferred_language as LanguageCode); setTimezone(pr.timezone); }
      setActivity(act ?? []);
      setLoading(false);
    })();
  }, [session]);

  async function save() {
    if (!session) return;
    setSaving(true);
    const { error } = await supabase.from('user_profiles').update({ full_name: fullName, preferred_language: preferredLang, timezone }).eq('id', session.user.id);
    setLang(preferredLang);
    setSaving(false);
    if (error) toast.error('Could not save', { description: error.message });
    else toast.success('Profile updated');
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  const initials = (fullName || session?.user.email || '?').split(/\s|@/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account information and recent activity.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">Account details</CardTitle><CardDescription>Update your personal information.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border border-border"><AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">{initials}</AvatarFallback></Avatar>
              <div>
                <p className="font-medium text-foreground">{fullName || 'User'}</p>
                <p className="text-sm text-muted-foreground">{session?.user.email}</p>
                <Badge variant="outline" className="mt-1 text-xs">Member since {profile ? new Date(profile.created_at).toLocaleDateString() : '—'}</Badge>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="name">Full name</Label><Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={session?.user.email ?? ''} disabled className="bg-muted/40" /></div>
              <div className="space-y-2">
                <Label>Preferred language</Label>
                <Select value={preferredLang} onValueChange={(v) => setPreferredLang(v as LanguageCode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-60">{LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.nativeName} ({l.name})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Timezone</Label><Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="UTC" /></div>
            </div>
            <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">Account status</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={Shield} label="Security" value={profile?.security_status ?? 'basic'} />
            <InfoRow icon={Mail} label="Email" value={session?.user.email ?? '—'} truncate />
            <InfoRow icon={Calendar} label="Joined" value={profile ? new Date(profile.created_at).toLocaleDateString() : '—'} />
            <InfoRow icon={Globe} label="Language" value={LANGUAGES.find((l) => l.code === preferredLang)?.name ?? 'English'} />
            <InfoRow icon={Clock} label="Timezone" value={timezone} />
          </CardContent>
        </Card>
      </div>
      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-lg">Recent activity</CardTitle><CardDescription>Your last 10 actions on the platform.</CardDescription></CardHeader>
        <CardContent>
          {activity.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p> : (
            <div className="space-y-2">
              {activity.map((a, i) => (
                <div key={i} className="flex items-center justify-between border-b border-border/40 pb-2 text-sm last:border-0">
                  <div><p className="font-medium text-foreground">{a.event.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</p>{a.detail && <p className="text-xs text-muted-foreground">{a.detail}</p>}</div>
                  <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, truncate }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; truncate?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /> {label}</span>
      <span className={`font-medium text-foreground ${truncate ? 'max-w-[160px] truncate' : ''}`}>{value}</span>
    </div>
  );
}