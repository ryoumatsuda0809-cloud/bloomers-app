
-- (A) Add client_organization_id column to compliance_logs
ALTER TABLE public.compliance_logs
  ADD COLUMN client_organization_id uuid REFERENCES public.organizations(id);

-- (B) Recreate view with both client_organization_name and location_name
-- Also fix the JOIN bug: c.driver_id = p.user_id (not p.id)
DROP VIEW IF EXISTS public.monthly_wait_risk_reports;

CREATE VIEW public.monthly_wait_risk_reports AS
SELECT
  o.name AS client_organization_name,
  c.location_name,
  date_trunc('month', c.recorded_at) AS report_month,
  count(*) AS total_visits,
  coalesce(sum(c.waiting_minutes), 0) AS total_wait_minutes,
  coalesce(sum(c.waiting_minutes * CASE p.vehicle_class
    WHEN '2t' THEN 40
    WHEN '4t' THEN 50
    WHEN '10t' THEN 70
    WHEN 'trailer' THEN 90
    ELSE 50
  END), 0) AS estimated_loss_jpy,
  CASE
    WHEN coalesce(avg(c.waiting_minutes), 0) >= 60 THEN '高'
    WHEN coalesce(avg(c.waiting_minutes), 0) >= 30 THEN '中'
    ELSE '低'
  END AS gmen_risk_level
FROM public.compliance_logs c
  JOIN public.profiles p ON c.driver_id = p.user_id
  LEFT JOIN public.organizations o ON c.client_organization_id = o.id
WHERE c.event_type = 'departure'
GROUP BY o.name, c.location_name, date_trunc('month', c.recorded_at);
