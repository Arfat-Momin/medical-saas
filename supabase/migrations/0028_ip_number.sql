-- ============================================================
-- 0028_ip_number.sql
-- IP Number on admissions
-- ============================================================

-- Sequential IP number counter per tenant
CREATE TABLE IF NOT EXISTS public.ip_counters (
  tenant_id  uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  last_value bigint NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.next_ip_number(p_tenant uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_next bigint;
BEGIN
  INSERT INTO public.ip_counters (tenant_id, last_value)
  VALUES (p_tenant, 1)
  ON CONFLICT (tenant_id)
  DO UPDATE SET last_value = public.ip_counters.last_value + 1
  RETURNING last_value INTO v_next;
  RETURN 'IP-' || lpad(v_next::text, 6, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION public.next_ip_number TO authenticated;

ALTER TABLE public.admissions
  ADD COLUMN IF NOT EXISTS ip_number text UNIQUE;

-- Back-fill trigger: assign ip_number on insert if null
CREATE OR REPLACE FUNCTION public.assign_ip_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ip_number IS NULL THEN
    NEW.ip_number := public.next_ip_number(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_ip_number
  BEFORE INSERT ON public.admissions
  FOR EACH ROW EXECUTE FUNCTION public.assign_ip_number();
