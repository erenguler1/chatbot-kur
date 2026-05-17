-- Migration 006: Fix bots SELECT policy for soft-delete via RETURNING
--
-- Problem: SELECT policy filters out deleted_at IS NOT NULL rows. When
-- UPDATE includes RETURNING (which PostgREST does by default), the new
-- row must pass the SELECT policy (PostgreSQL docs: "If the user does
-- not have a SELECT policy that allows seeing the modified row, then
-- the entire query will fail rather than just returning fewer rows.").
-- Setting deleted_at = NOW() makes the new row fail "deleted_at IS NULL",
-- causing error 42501: "new row violates row-level security policy".
--
-- Why this is consistent with the symptoms:
--   - UPDATE name='X' (deleted_at unchanged) → SELECT policy passes on
--     NEW row because deleted_at is still NULL. WORKS.
--   - UPDATE deleted_at=NOW() → SELECT policy fails on NEW row because
--     deleted_at IS NOT NULL. FAILS with 42501.
--
-- Fix: Drop "deleted_at IS NULL" from SELECT policy. The application
-- layer (useBots, useBot hooks) already filters out soft-deleted rows
-- via .is('deleted_at', null), so app behavior is unchanged.

DROP POLICY IF EXISTS bots_select_own ON public.bots;

CREATE POLICY bots_select_own ON public.bots
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
