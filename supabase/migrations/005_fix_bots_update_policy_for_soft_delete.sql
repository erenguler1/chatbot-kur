-- Migration 005: Fix bots UPDATE policy for soft-delete
--
-- Problem: Original UPDATE policy (in migration 002) had USING clause:
--   "auth.uid() = user_id AND deleted_at IS NULL"
--
-- When soft-deleting (UPDATE bots SET deleted_at = NOW()), Postgres
-- implicitly checks USING against the NEW row state. Since deleted_at
-- is no longer NULL after update, the policy fails with error 42501:
-- "new row violates row-level security policy for table 'bots'".
--
-- Fix: Remove "deleted_at IS NULL" from USING clause. The application
-- layer (useBots, useBot hooks) filters out soft-deleted bots from queries.
-- WITH CHECK still enforces auth.uid() = user_id, preventing cross-user updates.

DROP POLICY IF EXISTS bots_update_own ON public.bots;

CREATE POLICY bots_update_own ON public.bots
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
