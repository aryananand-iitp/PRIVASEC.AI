'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, ScanLine, ShieldAlert, ShieldCheck, History, FileText,
  BarChart3, GraduationCap, Bell, User, Settings, Lock, LogOut,
  Menu, X, ChevronLeft, Search, Globe,
} from 'lucide-react';
import { useAuth, useLang } from '@/components/providers';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LANGUAGES, LanguageCode } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type NavItem = {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV: NavItem[] = [
  { key: 'nav.overview', href: '/dashboard', icon: LayoutDashboard },
  { key: 'nav.analyze', href: '/dashboard/analyze', icon: ScanLine },
  { key: 'nav.threats', href: '/dashboard/threats', icon: ShieldAlert },
  { key: 'nav.protection', href: '/dashboard/protection', icon: ShieldCheck },
  { key: 'nav.history', href: '/dashboard/history', icon: History },
  { key: 'nav.reports', href: '/dashboard/reports', icon: FileText },
  { key: 'nav.analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { key: 'nav.learn', href: '/dashboard/learn', icon: GraduationCap },
  { key: 'nav.notifications', href: '/dashboard/notifications', icon: Bell },
  { key: 'nav.profile', href: '/dashboard/profile', icon: User },
  { key: 'nav.settings', href: '/dashboard/settings', icon: Settings },
  { key: 'nav.security', href: '/dashboard/security', icon: Lock },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading, signOut } = useAuth();
  const { lang, setLang, t } = useLang();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string | null; preferred_language: string } | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!loading && !session) router.replace('/signin');
  }, [loading, session, router]);

  const loadProfile = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from('user_profiles')
      .select('full_name, preferred_language')
      .eq('id', session.user.id)
      .maybeSingle();
    if (data) {
      setProfile({ full_name: data.full_name, preferred_language: data.preferred_language });
      setLang(data.preferred_language as LanguageCode);
    }
  }, [session, setLang]);

  const loadUnread = useCallback(async () => {
    if (!session) return;
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('read', false);
    setUnread(count ?? 0);
  }, [session]);

  useEffect(() => {
    loadProfile();
    loadUnread();
  }, [loadProfile, loadUnread]);

  if (loading || !session) return null;

  const initials = (profile?.full_name || session.user.email || '?')
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  async function handleSignOut() {
    await signOut();
    router.replace('/signin');
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — desktop */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border/60 bg-card transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          {!collapsed && <Logo size={22} />}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label="Toggle sidebar"
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin px-2 py-3">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                title={collapsed ? t(item.key) : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{t(item.key)}</span>}
                {!collapsed && item.key === 'nav.notifications' && unread > 0 && (
                  <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-foreground">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title={collapsed ? t('nav.logout') : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{t('nav.logout')}</span>}
          </button>
        </nav>
        {!collapsed && (
          <div className="border-t border-border/60 p-4">
            <div className="flex items-center gap-2 rounded-md bg-accent/10 px-3 py-2 text-xs text-accent-foreground">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <span>Detect. Understand. Protect.</span>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border/60 bg-card animate-fade-in">
            <div className="flex h-16 items-center justify-between px-4">
              <Logo size={22} />
              <button onClick={() => setMobileOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin px-2 py-3">
              {NAV.map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{t(item.key)}</span>
                    {item.key === 'nav.notifications' && unread > 0 && (
                      <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-xs font-semibold text-accent-foreground">{unread}</span>
                    )}
                  </Link>
                );
              })}
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                <span>{t('nav.logout')}</span>
              </button>
            </nav>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className={cn('flex flex-1 flex-col transition-all duration-300', collapsed ? 'md:ml-16' : 'md:ml-64')}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground md:flex">
              <Search className="h-4 w-4" />
              <span className="text-xs">Quick search…</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelector lang={lang} setLang={setLang} />
            <Link href="/dashboard/notifications">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
                )}
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full hover:bg-muted/60">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {profile?.full_name || 'User'}
                  <div className="truncate text-xs font-normal">{session.user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profile"><User className="mr-2 h-4 w-4" /> My Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings"><Settings className="mr-2 h-4 w-4" /> Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/security"><Lock className="mr-2 h-4 w-4" /> Security & Privacy</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function LanguageSelector({ lang, setLang }: { lang: LanguageCode; setLang: (l: LanguageCode) => void }) {
  const current = LANGUAGES.find((l) => l.code === lang);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">{current?.nativeName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto scrollbar-thin">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className={lang === l.code ? 'bg-accent/10' : ''}
          >
            <span className="flex w-full items-center justify-between">
              <span>{l.nativeName}</span>
              <span className="text-xs text-muted-foreground">{l.name}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}