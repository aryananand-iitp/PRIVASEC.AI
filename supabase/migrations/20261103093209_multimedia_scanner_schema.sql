/*
# PRIVASEC AI — Multimedia scanner schema

## Purpose
Extend the existing schema to support the new Multimedia Privacy Scanner
workflow (video/audio upload + live speech). The scanner transcribes media
in-browser (Whisper WASM / Web Speech API) and then runs the existing PII
engine on the transcript.

## Changes
1. `analyses.source_kind` CHECK constraint — add 'speech' to the allowed
   values so multimedia scans can be saved using the existing table.
2. New table `media_scans` — stores metadata about a multimedia scan run:
   the input type (video/audio/live), the original filename, duration in
   seconds, segment count, the confirmed transcript (text), language, and
   a link to the parent analysis row. Transcript text is stored so the user
   can revisit it; raw media bytes are NEVER stored (browser-only).

## Security
- RLS enabled on `media_scans`.
- Owner-scoped `TO authenticated` with `auth.uid()` checks, matching the
  existing pattern on all other tables.
- `DEFAULT auth.uid()` on `user_id` so inserts that omit it succeed.
- 4 policies (select/insert/update/delete), no `FOR ALL`.
- `GRANT SELECT, INSERT, UPDATE, DELETE` to `authenticated` and
  `service_role`.

## Notes
- We only alter the CHECK constraint (drop + recreate). No columns are
  dropped or renamed — existing data is preserved.
- Transcript text is the user-facing content the user chose to scan; raw
  audio/video file bytes are never persisted.
*/

-- 1. Extend analyses.source_kind to include 'speech'
ALTER TABLE analyses DROP CONSTRAINT IF EXISTS analyses_source_kind_check;
ALTER TABLE analyses ADD CONSTRAINT analyses_source_kind_check
  CHECK (source_kind IN ('text','image','pdf','video','audio','subtitle','metadata','speech'));

-- 2. New table: media_scans
CREATE TABLE IF NOT EXISTS media_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id uuid REFERENCES analyses(id) ON DELETE CASCADE,
  input_type text NOT NULL CHECK (input_type IN ('video','audio','live')),
  original_filename text,
  media_duration_s real,
  segment_count integer NOT NULL DEFAULT 0,
  transcript text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE media_scans ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON media_scans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON media_scans TO service_role;

DROP POLICY IF EXISTS "media_scans_select_own" ON media_scans;
CREATE POLICY "media_scans_select_own" ON media_scans FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "media_scans_insert_own" ON media_scans;
CREATE POLICY "media_scans_insert_own" ON media_scans FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "media_scans_update_own" ON media_scans;
CREATE POLICY "media_scans_update_own" ON media_scans FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "media_scans_delete_own" ON media_scans;
CREATE POLICY "media_scans_delete_own" ON media_scans FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_media_scans_user_created ON media_scans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_scans_analysis ON media_scans(analysis_id);

DROP TRIGGER IF EXISTS media_scans_updated_at ON media_scans;
CREATE TRIGGER media_scans_updated_at BEFORE UPDATE ON media_scans
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
