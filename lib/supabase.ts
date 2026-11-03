import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    client = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

// Proxy that lazily creates the client on first access — safe for SSR/prerendering.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient();
    const val = (c as any)[prop];
    return typeof val === 'function' ? val.bind(c) : val;
  },
});

export type AnalysisRow = {
  id: string;
  user_id: string;
  source_kind: 'text' | 'image' | 'pdf' | 'video' | 'audio' | 'subtitle' | 'metadata';
  original_filename: string | null;
  original_text: string | null;
  protected_text: string | null;
  risk_score: number | null;
  status: 'analyzing' | 'analyzed' | 'protected' | 'failed';
  detection_count: number;
  processing_ms: number | null;
  language: string;
  created_at: string;
  updated_at: string;
};

export type DetectionRow = {
  id: string;
  analysis_id: string;
  user_id: string;
  category: string;
  masked_value: string;
  snippet: string;
  location: string | null;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  why_sensitive: string | null;
  why_matters: string | null;
  recommended_action: string | null;
  redaction_status: 'none' | 'masked' | 'redacted';
  verification_status: 'unverified' | 'verified_failed' | 'verified_passed';
  created_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  kind: 'info' | 'success' | 'warning' | 'danger' | 'recommendation';
  read: boolean;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  preferred_language: string;
  timezone: string;
  onboarding_completed: boolean;
  security_status: string;
  created_at: string;
  updated_at: string;
};

export type PreferenceRow = {
  user_id: string;
  theme: 'light' | 'dark' | 'system';
  hidden_widgets: string[];
  retention_days: number;
  third_party_ai_consent: boolean;
  updated_at: string;
};
