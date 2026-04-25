DROP VIEW IF EXISTS monthly_wait_risk_reports;

CREATE VIEW monthly_wait_risk_reports
WITH (security_invoker = true) AS
SELECT
  f.client_name AS client_organization_name,
  f.name AS location_name,
  date_trunc('month', w.work_end_time AT TIME ZONE 'Asia/Tokyo')
    AT TIME ZONE 'Asia/Tokyo' AS report_month,
  count(*) AS total_visits,
  COALESCE(sum(
    EXTRACT(EPOCH FROM (COALESCE(w.called_time, w.work_start_time) - w.arrival_time)) / 60
  )::integer, 0) AS total_wait_minutes,
  COALESCE(sum(
    (EXTRACT(EPOCH FROM (COALESCE(w.called_time, w.work_start_time) - w.arrival_time)) / 60)::integer
    * CASE p.vehicle_class
        WHEN '2t' THEN 40
        WHEN '4t' THEN 50
        WHEN '10t' THEN 70
        WHEN 'trailer' THEN 90
        ELSE 50
      END
  ), 0) AS estimated_loss_jpy,
  CASE
    WHEN COALESCE(avg(
      EXTRACT(EPOCH FROM (COALESCE(w.called_time, w.work_start_time) - w.arrival_time)) / 60
    ), 0) >= 60 THEN '高'
    WHEN COALESCE(avg(
      EXTRACT(EPOCH FROM (COALESCE(w.called_time, w.work_start_time) - w.arrival_time)) / 60
    ), 0) >= 30 THEN '中'
    ELSE '低'
  END AS gmen_risk_level
FROM wait_logs w
  JOIN facilities f ON f.id = w.facility_id
  JOIN profiles p ON w.user_id = p.user_id
WHERE w.status = 'completed'
  AND w.work_end_time IS NOT NULL
GROUP BY f.client_name, f.name,
  date_trunc('month', w.work_end_time AT TIME ZONE 'Asia/Tokyo');