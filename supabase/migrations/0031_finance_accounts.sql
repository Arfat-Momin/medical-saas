-- DB migration 0031_finance_accounts.sql
CREATE TABLE public.accounts_book (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id       uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  entry_type      text NOT NULL CHECK (entry_type IN ('INCOME','EXPENSE','REFUND','ADJUSTMENT')),
  category        text,           -- 'CONSULTATION','PHARMACY','LAB','IPD','SALARY','UTILITY' etc.
  description     text NOT NULL,
  amount          numeric(12,2) NOT NULL,
  payment_mode    text NOT NULL CHECK (payment_mode IN
    ('CASH','CARD','UPI','CHEQUE','NEFT_RTGS','INSURANCE','PACKAGE','CREDIT','OTHER')),
  coverage_type   text,           -- if insurance/scheme payment
  reference_no    text,           -- receipt / transaction number
  source_table    text,           -- 'invoices','payments','refunds' (for auto-entries)
  source_id       uuid,           -- FK to source row
  balance         numeric(12,2),  -- running balance (computed on insert trigger)
  recorded_by     uuid REFERENCES public.users(id),
  entry_date      date NOT NULL DEFAULT current_date,
  entry_time      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_tenant_date ON public.accounts_book(tenant_id, entry_date);
CREATE INDEX idx_accounts_source ON public.accounts_book(source_table, source_id);

ALTER TABLE public.accounts_book ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_tenant ON public.accounts_book
  FOR ALL USING (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

CREATE TABLE public.cash_closing (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id         uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  closing_date      date NOT NULL,
  opening_balance   numeric(12,2) NOT NULL DEFAULT 0,
  cash_receipts     numeric(12,2) NOT NULL DEFAULT 0,
  cash_expenses     numeric(12,2) NOT NULL DEFAULT 0,
  cash_refunds      numeric(12,2) NOT NULL DEFAULT 0,
  expected_cash     numeric(12,2) GENERATED ALWAYS AS
    (opening_balance + cash_receipts - cash_expenses - cash_refunds) STORED,
  actual_cash       numeric(12,2),
  difference        numeric(12,2) GENERATED ALWAYS AS
    (actual_cash - (opening_balance + cash_receipts - cash_expenses - cash_refunds)) STORED,
  notes             text,
  closed_by         uuid REFERENCES public.users(id),
  closed_at         timestamptz,
  status            text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, branch_id, closing_date)
);

-- Trigger: when a closing is finalised, insert the next day's opening balance
CREATE OR REPLACE FUNCTION public.carry_forward_cash()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'CLOSED' AND OLD.status = 'OPEN' THEN
    INSERT INTO public.cash_closing
      (tenant_id, branch_id, closing_date, opening_balance, status)
    VALUES
      (NEW.tenant_id, NEW.branch_id, NEW.closing_date + 1, NEW.actual_cash, 'OPEN')
    ON CONFLICT (tenant_id, branch_id, closing_date) DO UPDATE
      SET opening_balance = EXCLUDED.opening_balance;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_carry_forward
  AFTER UPDATE ON public.cash_closing
  FOR EACH ROW EXECUTE FUNCTION public.carry_forward_cash();

ALTER TABLE public.cash_closing ENABLE ROW LEVEL SECURITY;
CREATE POLICY cash_closing_tenant ON public.cash_closing
  FOR ALL USING (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- Trigger on payments → auto-insert INCOME entry
CREATE OR REPLACE FUNCTION public.auto_accounts_from_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.invoices%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = NEW.invoice_id;
  INSERT INTO public.accounts_book
    (tenant_id, branch_id, entry_type, category, description,
     amount, payment_mode, reference_no, source_table, source_id, recorded_by, entry_date)
  VALUES
    (NEW.tenant_id, v_inv.branch_id, 'INCOME', 'BILLING',
     'Payment for ' || v_inv.invoice_no,
     NEW.amount, NEW.method, NEW.reference, 'payments', NEW.id,
     NEW.received_by, NEW.received_at::date);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_accounts_payment
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.auto_accounts_from_payment();
