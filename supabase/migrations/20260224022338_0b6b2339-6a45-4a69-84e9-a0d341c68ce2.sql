
-- Allow service role to update payments (for dedup logic)
CREATE POLICY "Service role can update payments"
ON public.payments
FOR UPDATE
USING (true)
WITH CHECK (true);
