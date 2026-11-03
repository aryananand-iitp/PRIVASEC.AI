'use client';

import { useState, useEffect } from 'react';
import { Bell, Loader2, Check, Trash2, Info, AlertTriangle, ShieldAlert, Lightbulb, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/components/providers';
import { supabase, type NotificationRow } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const kindIcon = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: ShieldAlert, recommendation: Lightbulb };
const kindColor = { info: 'text-primary', success: 'text-success', warning: 'text-warning-foreground', danger: 'text-destructive', recommendation: 'text-accent-foreground' };

export default function NotificationsPage() {
  const { session } = useAuth();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!session) return;
      const { data } = await supabase.from('notifications').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
      setRows((data as NotificationRow[]) ?? []);
      setLoading(false);
    })();
  }, [session]);

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setRows((r) => r.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }
  async function markAllRead() {
    if (!session) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', session.user.id).eq('read', false);
    setRows((r) => r.map((n) => ({ ...n, read: true })));
  }
  async function remove(id: string) {
    await supabase.from('notifications').delete().eq('id', id);
    setRows((r) => r.filter((n) => n.id !== id));
  }

  const unread = rows.filter((r) => !r.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">{unread} unread of {rows.length} total</p>
        </div>
        {unread > 0 && <Button variant="outline" size="sm" onClick={markAllRead}><Check className="mr-2 h-4 w-4" /> Mark all read</Button>}
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No notifications</p>
            <p className="mt-1 text-xs text-muted-foreground">You'll see analysis results and security alerts here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((n) => {
            const Icon = kindIcon[n.kind] ?? Info;
            return (
              <Card key={n.id} className={cn('border-border/60', !n.read && 'bg-accent/5')}>
                <CardContent className="flex items-start gap-3 p-4">
                  <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', kindColor[n.kind])} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      {!n.read && <Badge variant="secondary" className="text-xs">New</Badge>}
                    </div>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {!n.read && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markRead(n.id)}><Check className="h-3.5 w-3.5" /></Button>}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(n.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}