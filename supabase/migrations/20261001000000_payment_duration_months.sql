-- Payments open the user for the duration chosen by the admin (1 or 3 months).
alter table public.payment
  add column if not exists duration_months int;

-- Existing payments were recorded under the old fixed 1-month rule.
update public.payment
set duration_months = 1
where duration_months is null;

alter table public.payment
  alter column duration_months set default 1;

-- Restrict to the durations the app offers; legacy rows are already 1.
alter table public.payment
  add constraint payment_duration_months_check
  check (duration_months in (1, 3));
