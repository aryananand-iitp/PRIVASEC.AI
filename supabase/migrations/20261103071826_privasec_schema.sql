/*
# PRIVASEC AI — Core schema

## Purpose
Multi-user privacy intelligence platform. Users sign in with Supabase Auth
(email/password). Each user can only access their own analyses, detections,
reports, notifications, preferences, and activity.

## New tables
1. `user_profiles` — display name, avatar_url, preferred_language, timezone,
   onboarding_completed flag, security_status.
2. `analyses` — one row per analysis run. Owner-scoped. Stores the source
   kind (text/image/pdf/video/audio/subtitle/metadata), original filename,
   original content (text only), protected content (text only), risk_score
   (0-100), status (analyzing/analyzed/protected/failed), detection_count,
   processing_ms.
3. `detections` — one row per PII finding inside an analysis. Linked to
   `analyses` by FK. Stores category, masked_value, snippet, location,
   confidence (0-1), severity (low/medium/high/critical), why_sensitive,
   why_matters, recommended_action, redaction_status (none/masked/redacted),
   verification_status (unverified/verified_failed/verified_passed).
4. `notifications` — owner-scoped in-app notifications.
5. `preferences` — one row per user (dashboard widget visibility, theme,
   retention days, third-party AI consent).
6. `activity` — lightweight usage audit events (login, analysis_started,
   analysis_completed, protection_applied, report_downloaded). No raw file
   content stored here.
7. `reports` — generated report metadata (analysis_id, format, risk_score,
   detection summary). No raw PII stored.
8. `user_sessions` — login/logout session tracking (last_login, active
   duration accumulator).

## Security
- RLS enabled on every table.
- All tables scoped `TO authenticated` with `auth.uid()` ownership checks.
- Owner columns default to `auth.uid()` so inserts that omit `user_id` succeed.
- `GRANT SELECT, INSERT, UPDATE, DELETE` to `authenticated` only (no anon —
  the app requires sign-in).
- `service_role` granted on all tables so edge functions / service code can
  operate when needed.
- 4 policies per table (select/insert/update/delete), no `FOR ALL`.

## Notes
- We deliberately do NOT store raw uploaded files in the database. Only the
  pasted text content (for text analyses) is stored so the user can review
  history; image/pdf/video/audio file bytes are never persisted. Pasted text
  is kept because it is the thing the user wants to re-open and re-read later.
- Detection `masked_value` always stores a masked representation, never the
  raw sensitive value. The `snippet` stores a small surrounding-context
  window for the user to locate the finding, which is needed for the
  Explainable AI view.
*/

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  full_name text,
  avatar_url text,
  preferred_language text NOT NULL DEFAULT 'en',
  timezone text NOT NULL DEFAULT 'UTC',
  onboarding_completed boolean NOT NULL DEFAULT false,
  security_status text NOT NULL DEFAULT 'basic',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_id_fk FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN ('text','image','pdf','video','audio','subtitle','metadata')),
  original_filename text,
  original_text text,
  protected_text text,
  risk_score integer CHECK (risk_score >= 0 AND risk_score <= 100),
  status text NOT NULL DEFAULT 'analyzing' CHECK (status IN ('analyzing','analyzed','protected','failed')),
  detection_count integer NOT NULL DEFAULT 0,
  processing_ms integer,
  language text NOT NULL DEFAULT 'auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  masked_value text NOT NULL,
  snippet text NOT NULL,
  location text,
  confidence real NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  why_sensitive text,
  why_matters text,
  recommended_action text,
  redaction_status text NOT NULL DEFAULT 'none' CHECK (redaction_status IN ('none','masked','redacted')),
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','verified_failed','verified_passed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'info' CHECK (kind IN ('info','success','warning','danger','recommendation')),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preferences (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  hidden_widgets text[] NOT NULL DEFAULT '{}',
  retention_days integer NOT NULL DEFAULT 30,
  third_party_ai_consent boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  format text NOT NULL DEFAULT 'json' CHECK (format IN ('json','pdf')),
  risk_score integer,
  detection_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_in_at timestamptz NOT NULL DEFAULT now(),
  logged_out_at timestamptz,
  duration_s integer
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analyses_user_created ON analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_detections_analysis ON detections(analysis_id);
CREATE INDEX IF NOT EXISTS idx_detections_user ON detections(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user_created ON activity(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id, logged_in_at DESC);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON analyses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON detections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON activity TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_sessions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON analyses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON detections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON preferences TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON activity TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_sessions TO service_role;

-- user_profiles policies (id == auth.uid())
DROP POLICY IF EXISTS "profiles_select_own" ON user_profiles;
CREATE POLICY "profiles_select_own" ON user_profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON user_profiles;
CREATE POLICY "profiles_insert_own" ON user_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON user_profiles;
CREATE POLICY "profiles_update_own" ON user_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_delete_own" ON user_profiles;
CREATE POLICY "profiles_delete_own" ON user_profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- analyses policies
DROP POLICY IF EXISTS "analyses_select_own" ON analyses;
CREATE POLICY "analyses_select_own" ON analyses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "analyses_insert_own" ON analyses;
CREATE POLICY "analyses_insert_own" ON analyses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "analyses_update_own" ON analyses;
CREATE POLICY "analyses_update_own" ON analyses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "analyses_delete_own" ON analyses;
CREATE POLICY "analyses_delete_own" ON analyses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- detections policies
DROP POLICY IF EXISTS "detections_select_own" ON detections;
CREATE POLICY "detections_select_own" ON detections FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "detections_insert_own" ON detections;
CREATE POLICY "detections_insert_own" ON detections FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "detections_update_own" ON detections;
CREATE POLICY "detections_update_own" ON detections FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "detections_delete_own" ON detections;
CREATE POLICY "detections_delete_own" ON detections FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- notifications policies
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- preferences policies
DROP POLICY IF EXISTS "preferences_select_own" ON preferences;
CREATE POLICY "preferences_select_own" ON preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "preferences_insert_own" ON preferences;
CREATE POLICY "preferences_insert_own" ON preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "preferences_update_own" ON preferences;
CREATE POLICY "preferences_update_own" ON preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "preferences_delete_own" ON preferences;
CREATE POLICY "preferences_delete_own" ON preferences FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- activity policies
DROP POLICY IF EXISTS "activity_select_own" ON activity;
CREATE POLICY "activity_select_own" ON activity FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "activity_insert_own" ON activity;
CREATE POLICY "activity_insert_own" ON activity FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "activity_update_own" ON activity;
CREATE POLICY "activity_update_own" ON activity FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "activity_delete_own" ON activity;
CREATE POLICY "activity_delete_own" ON activity FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- reports policies
DROP POLICY IF EXISTS "reports_select_own" ON reports;
CREATE POLICY "reports_select_own" ON reports FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "reports_insert_own" ON reports;
CREATE POLICY "reports_insert_own" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "reports_update_own" ON reports;
CREATE POLICY "reports_update_own" ON reports FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "reports_delete_own" ON reports;
CREATE POLICY "reports_delete_own" ON reports FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- user_sessions policies
DROP POLICY IF EXISTS "sessions_select_own" ON user_sessions;
CREATE POLICY "sessions_select_own" ON user_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "sessions_insert_own" ON user_sessions;
CREATE POLICY "sessions_insert_own" ON user_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "sessions_update_own" ON user_sessions;
CREATE POLICY "sessions_update_own" ON user_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "sessions_delete_own" ON user_sessions;
CREATE POLICY "sessions_delete_own" ON user_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS analyses_updated_at ON analyses;
CREATE TRIGGER analyses_updated_at BEFORE UPDATE ON analyses
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

DROP TRIGGER IF EXISTS preferences_updated_at ON preferences;
CREATE TRIGGER preferences_updated_at BEFORE UPDATE ON preferences
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
