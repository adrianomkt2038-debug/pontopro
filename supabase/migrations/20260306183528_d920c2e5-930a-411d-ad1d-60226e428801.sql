
CREATE TABLE public.audit_entidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.audit_entidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audit_entidades"
ON public.audit_entidades
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
