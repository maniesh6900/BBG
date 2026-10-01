-- Duration is no longer stored: the amount paid (600 = 1 month, 1500 = 3 months)
-- determines how long a payment opens the user.
alter table public.payment
  drop constraint if exists payment_duration_months_check;

alter table public.payment
  drop column if exists duration_months;
