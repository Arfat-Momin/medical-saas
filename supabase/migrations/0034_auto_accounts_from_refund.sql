-- DB migration 0034_auto_accounts_from_refund.sql

-- Trigger on refunds → auto-insert REFUND entry
CREATE OR REPLACE FUNCTION public.auto_accounts_from_refund()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
  v_inv public.invoices%ROWTYPE;
  v_pay_method text;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = NEW.invoice_id;
  
  IF NEW.payment_id IS NOT NULL THEN
    SELECT method INTO v_pay_method FROM public.payments WHERE id = NEW.payment_id;
  END IF;
  
  v_pay_method := COALESCE(v_pay_method, 'CASH');

  INSERT INTO public.accounts_book
    (tenant_id, branch_id, entry_type, category, description,
     amount, payment_mode, reference_no, source_table, source_id, recorded_by, entry_date)
  VALUES
    (NEW.tenant_id, v_inv.branch_id, 'REFUND', 'BILLING',
     'Refund for ' || v_inv.invoice_no,
     NEW.amount, v_pay_method, NULL, 'refunds', NEW.id,
     NEW.refunded_by, NEW.refunded_at::date);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_accounts_refund
  AFTER INSERT ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.auto_accounts_from_refund();
