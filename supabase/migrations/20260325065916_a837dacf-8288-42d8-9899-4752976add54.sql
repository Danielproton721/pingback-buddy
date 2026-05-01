
-- Allow users to delete their own payments
CREATE POLICY "Users can delete their own payments"
ON public.payments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to delete their own webhook logs
CREATE POLICY "Users can delete their own webhook logs"
ON public.webhook_logs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
