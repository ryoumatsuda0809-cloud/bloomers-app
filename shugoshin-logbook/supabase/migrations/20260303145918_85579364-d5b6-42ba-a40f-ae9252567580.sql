
-- Fix SECURITY DEFINER view issue: set security_invoker = true
ALTER VIEW public.monthly_wait_risk_reports SET (security_invoker = true);
