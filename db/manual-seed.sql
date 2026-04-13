insert into currencies (code, name, symbol, decimal_places)
values
  ('USD', 'US Dollar', '$', 2),
  ('KRW', 'South Korean Won', '₩', 0),
  ('EUR', 'Euro', '€', 2)
on conflict (code) do nothing;

insert into users (display_name, email, password_hash)
values (
  'Owner',
  'owner@example.com',
  'replace-with-generated-password-hash'
)
on conflict (email) do nothing;

with owner_user as (
  select id from users where email = 'owner@example.com'
),
usd as (
  select id from currencies where code = 'USD'
),
budget_row as (
  insert into budgets (name, default_reporting_currency_id)
  select 'Household Budget', usd.id
  from usd
  where not exists (select 1 from budgets where name = 'Household Budget')
  returning id
),
resolved_budget as (
  select id from budget_row
  union all
  select id from budgets where name = 'Household Budget'
  limit 1
)
insert into budget_memberships (budget_id, user_id, role)
select resolved_budget.id, owner_user.id, 'owner'
from resolved_budget, owner_user
where not exists (
  select 1
  from budget_memberships bm
  where bm.budget_id = resolved_budget.id
    and bm.user_id = owner_user.id
);
