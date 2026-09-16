-- ============================================================
-- 0022_immutable_ledgers.sql
-- Enforce that payments, refunds and stock_transactions cannot
-- be silently modified or deleted. Corrections must be new rows.
-- ============================================================

create or replace function public.block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Table % is append-only. Corrections must be new rows.', TG_TABLE_NAME
    using errcode = '45000';
end;
$$;

drop trigger if exists trg_payments_immutable on public.payments;
create trigger trg_payments_immutable
  before update or delete on public.payments
  for each row execute function public.block_mutation();

drop trigger if exists trg_refunds_immutable on public.refunds;
create trigger trg_refunds_immutable
  before update or delete on public.refunds
  for each row execute function public.block_mutation();

drop trigger if exists trg_stock_tx_immutable on public.stock_transactions;
create trigger trg_stock_tx_immutable
  before update or delete on public.stock_transactions
  for each row execute function public.block_mutation();