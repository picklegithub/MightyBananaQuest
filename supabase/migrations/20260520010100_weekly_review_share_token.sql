-- Phase 5: Read-only sharing links for weekly reviews.

ALTER TABLE public.weekly_reviews
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS weekly_reviews_share_token_idx
  ON public.weekly_reviews (share_token)
  WHERE share_token IS NOT NULL;

-- RPC: anonymous access via token — SECURITY DEFINER bypasses RLS
CREATE OR REPLACE FUNCTION public.get_shared_review(p_token UUID)
RETURNS SETOF public.weekly_reviews
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM public.weekly_reviews
  WHERE share_token = p_token AND share_token IS NOT NULL;
$$;
