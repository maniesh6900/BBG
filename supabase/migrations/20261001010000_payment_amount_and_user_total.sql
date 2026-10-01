-- Each payment records how much money was paid. Only the fixed plan prices
-- are allowed: 600 opens for 1 month, 1500 opens for 3 months.
alter table public.payment
  add column if not exists amount numeric(12, 2) not null default 600;

alter table public.payment
  drop constraint if exists payment_amount_check;

alter table public.payment
  add constraint payment_amount_check
  check (amount in (600, 1500));

-- Running total of everything a user has paid, kept on the users table.
alter table public.users
  add column if not exists total_amount numeric(12, 2) not null default 0;

-- Backfill the total from existing payments.
update public.users u
set total_amount = coalesce(agg.total, 0)
from (
  select payed_by, sum(amount) as total
  from public.payment
  group by payed_by
) agg
where agg.payed_by = u.id
  and u.total_amount = 0;

-- Keep total_amount in sync on every payment insert.
create or replace function public.add_payment_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set total_amount = total_amount + new.amount
  where id = new.payed_by;

  return new;
end;
$$;

drop trigger if exists payment_amount_sync on public.payment;

create trigger payment_amount_sync
  after insert on public.payment
  for each row
  execute function public.add_payment_amount();
