'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { LanguageCode, translate, RTL_LANGUAGES } from '@/lib/i18n';
import { ThemeProvider } from 'next-themes';

// ---- Auth context ----
type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      (async () => {
        if (event === 'SIGNED_OUT') {
          setSession(null);
        } else if (sess) {
          setSession(sess);
        }
        setLoading(false);
      })();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// ---- Language context ----
type LangState = {
  lang: LanguageCode;
  setLang: (l: LanguageCode) => void;
  t: (key: string) => string;
  rtl: boolean;
};

const LangContext = createContext<LangState>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
  rtl: false,
});

function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>('en');

  useEffect(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('privasec-lang')) as LanguageCode | null;
    if (saved) setLangState(saved);
  }, []);

  const setLang = useCallback((l: LanguageCode) => {
    setLangState(l);
    if (typeof localStorage !== 'undefined') localStorage.setItem('privasec-lang', l);
  }, []);

  const rtl = RTL_LANGUAGES.includes(lang);
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    }
  }, [lang, rtl]);

  const t = useCallback((key: string) => translate(lang, key), [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t, rtl }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

// ---- Combined providers ----
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <LangProvider>
        <AuthProvider>{children}</AuthProvider>
      </LangProvider>
    </ThemeProvider>
  );
}