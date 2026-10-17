-- Migration 013: RLS policies + service_role/anon GRANTs for documents table
-- Users see only their own bot documents; Edge Functions use service_role bypass.

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- SELECT: user sees only documents belonging to their own bots
CREATE POLICY "documents_select_own" ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = documents.bot_id
        AND bots.user_id = auth.uid()
    )
  );

-- INSERT: user can insert only for their own bots
CREATE POLICY "documents_insert_own" ON documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_id
        AND bots.user_id = auth.uid()
    )
  );

-- UPDATE: user can update only their own bot's documents (for soft delete)
CREATE POLICY "documents_update_own" ON documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = documents.bot_id
        AND bots.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = bot_id
        AND bots.user_id = auth.uid()
    )
  );

-- service_role: full access (Edge Functions bypass RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO service_role;

-- authenticated role: needed for RLS-checked queries from client
GRANT SELECT, INSERT, UPDATE ON documents TO authenticated;