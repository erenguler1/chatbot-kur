-- Migration 004: Grant table permissions to authenticated role
--
-- Applied manually on Day 3 (codified here for reproducibility).
--
-- Supabase's default GRANTs to the `authenticated` role do not cover
-- custom application tables. Without these GRANTs, even with permissive
-- RLS policies, authenticated users get permission-denied errors before
-- RLS is evaluated.
--
-- DELETE is intentionally omitted: hard-delete is denied (no DELETE
-- policy); removal is performed via soft-delete (UPDATE deleted_at).

GRANT SELECT, INSERT, UPDATE ON public.bots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.qa_pairs TO authenticated;
