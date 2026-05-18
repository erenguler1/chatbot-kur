-- Migration 007: Fix qa_pairs SELECT policy for soft-delete via RETURNING
--
-- Problem: Original SELECT policy (in migration 003) included
-- "qa_pairs.deleted_at IS NULL" in its USING clause. When the application
-- performs a soft-delete via UPDATE qa_pairs SET deleted_at = NOW(),
-- PostgREST returns the modified row by default (RETURNING *). Per
-- PostgreSQL docs, the NEW row must pass the SELECT policy for RETURNING
-- to succeed; otherwise the whole statement fails with error 42501:
-- "new row violates row-level security policy".
--
-- This is the exact same class of bug fixed for the bots table in
-- migration 006. qa_pairs UPDATE policy is already free of this trap
-- (it never filtered on qa_pairs.deleted_at; only checks parent bot
-- ownership via EXISTS subquery), so an analogue of migration 005 is
-- NOT needed here.
--
-- Fix: Drop "deleted_at IS NULL" from the qa_pairs SELECT policy. The
-- application layer (useQAPairs hook) already filters soft-deleted rows
-- via .is('deleted_at', null), so user-visible behavior is unchanged.
-- The parent-bot ownership + active-bot checks remain enforced.

DROP POLICY IF EXISTS "qa_pairs_select_own" ON public.qa_pairs;

CREATE POLICY "qa_pairs_select_own"
  ON public.qa_pairs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.bots
      WHERE bots.id = qa_pairs.bot_id
        AND bots.user_id = auth.uid()
        AND bots.deleted_at IS NULL
    )
  );
