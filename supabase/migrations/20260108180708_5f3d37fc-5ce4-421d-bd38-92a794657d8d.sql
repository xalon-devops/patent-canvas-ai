-- Add policy allowing admins to view all user records
CREATE POLICY "Admins can view all users" 
ON public.users 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));