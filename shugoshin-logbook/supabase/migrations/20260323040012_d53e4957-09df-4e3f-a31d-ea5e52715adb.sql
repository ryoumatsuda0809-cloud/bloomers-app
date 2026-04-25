-- UPDATE を明示的に禁止（RESTRICTIVEなので他のPERMISSIVEポリシーがあっても拒否）
CREATE POLICY "Immutable: no updates allowed"
ON public.submitted_reports
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (false);

-- DELETE を明示的に禁止
CREATE POLICY "Immutable: no deletes allowed"
ON public.submitted_reports
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (false);