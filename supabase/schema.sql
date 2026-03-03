-- ============================================================
-- CapCenter Underwrite — Database Schema
-- Run this in Supabase SQL Editor before starting the app.
-- ============================================================

-- ─── EXTENSIONS ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── USER PROFILES ──────────────────────────────────────────
-- Extends Supabase auth.users with role and display name.
-- A row here is created manually (or via trigger) after sign-up.

create table if not exists user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null check (role in ('underwriter', 'loan_officer', 'manager')),
  created_at  timestamptz default now()
);

-- Auto-create a placeholder profile on sign-up so the app doesn't break.
-- You still need to set the role and name manually or via your onboarding flow.
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into user_profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'New User'), 'underwriter')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── LOANS ──────────────────────────────────────────────────
create table if not exists loans (
  id                text primary key,               -- e.g. "LN-2024-0041"
  loan_officer_id   uuid references user_profiles(id),
  loan_officer_name text,                           -- denormalized for display
  loan_amount       numeric(12, 2),
  property_address  text,
  loan_purpose      text check (loan_purpose in ('Purchase', 'Refinance', 'Cash-Out Refinance')),
  status            text not null default 'Not Started'
                    check (status in ('Not Started','Documents Uploaded','Extracted','In Review','Finalized')),
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ─── BORROWERS ──────────────────────────────────────────────
create table if not exists borrowers (
  id              uuid primary key default gen_random_uuid(),
  loan_id         text not null references loans(id) on delete cascade,
  name            text not null,
  is_self_employed boolean not null default true,
  business_type   text,                             -- e.g. "Schedule C – Sole Proprietor"
  w2_annual_income numeric(12, 2),                  -- for non-self-employed co-borrowers
  sort_order      int default 0,
  created_at      timestamptz default now()
);

-- ─── TAX RETURNS ────────────────────────────────────────────
-- One row per borrower per tax year.

create table if not exists tax_returns (
  id                uuid primary key default gen_random_uuid(),
  borrower_id       uuid not null references borrowers(id) on delete cascade,
  loan_id           text not null references loans(id) on delete cascade,
  tax_year          int not null check (tax_year >= 2010 and tax_year <= 2030),
  storage_path      text,                           -- path in Supabase Storage bucket "tax-returns"
  original_filename text,
  uploaded_at       timestamptz,
  uploaded_by       uuid references user_profiles(id),
  extracted_fields  jsonb,                          -- all raw extracted field values
  field_confidence  jsonb,                          -- confidence level per field: "high"|"medium"|"low"
  extraction_status text default 'pending'
                    check (extraction_status in ('pending','running','complete','failed')),
  extraction_error  text,                           -- error message if extraction failed
  extracted_at      timestamptz,
  created_at        timestamptz default now(),
  unique(borrower_id, tax_year)
);

-- ─── FIELD OVERRIDES ────────────────────────────────────────
-- Every manual correction an underwriter makes is recorded here.
-- This is the audit trail. Never delete rows; soft-apply only.

create table if not exists field_overrides (
  id                uuid primary key default gen_random_uuid(),
  tax_return_id     uuid not null references tax_returns(id) on delete cascade,
  field_name        text not null,
  original_value    numeric,
  overridden_value  numeric not null,
  override_reason   text,                           -- optional note from underwriter
  overridden_by     uuid not null references user_profiles(id),
  overridden_at     timestamptz default now()
);

-- ─── INCOME CALCULATIONS ────────────────────────────────────
-- Snapshot of calculated qualifying income, written when underwriter
-- finalizes or saves the income review. Preserves the calculation at
-- a point in time even if extracted fields change later.

create table if not exists income_calculations (
  id              uuid primary key default gen_random_uuid(),
  loan_id         text not null references loans(id) on delete cascade,
  borrower_id     uuid not null references borrowers(id) on delete cascade,
  calculated_by   uuid not null references user_profiles(id),
  calculated_at   timestamptz default now(),
  agency          text not null check (agency in ('FNMA','FHLMC','FHA','VA')),
  qualifying_monthly_income  numeric(12, 2),
  qualifying_annual_income   numeric(12, 2),
  flag            text,                             -- e.g. "SHARP_DECLINE"
  is_eligible     boolean not null default true,
  calc_inputs     jsonb,                            -- snapshot of merged fields used
  calc_breakdown  jsonb                             -- step-by-step add-back detail
);

-- ─── UPDATED_AT TRIGGER ─────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger loans_updated_at
  before update on loans
  for each row execute function set_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
-- Enable RLS on all tables. Without this, any authenticated user
-- can read/write all rows.

alter table user_profiles     enable row level security;
alter table loans              enable row level security;
alter table borrowers          enable row level security;
alter table tax_returns        enable row level security;
alter table field_overrides    enable row level security;
alter table income_calculations enable row level security;

-- Helper: get the current user's role without a subquery
create or replace function current_user_role()
returns text language sql security definer stable as $$
  select role from user_profiles where id = auth.uid();
$$;

-- user_profiles: users can read their own row; managers can read all
create policy "users_read_own_profile"
  on user_profiles for select
  using (id = auth.uid() or current_user_role() = 'manager');

create policy "users_update_own_profile"
  on user_profiles for update
  using (id = auth.uid());

-- loans: all authenticated users can read; only loan officers and managers can insert
create policy "authenticated_read_loans"
  on loans for select
  using (auth.role() = 'authenticated');

create policy "lo_manager_insert_loans"
  on loans for insert
  with check (current_user_role() in ('loan_officer', 'manager'));

create policy "lo_manager_update_loans"
  on loans for update
  using (current_user_role() in ('loan_officer', 'manager', 'underwriter'));

-- borrowers: all authenticated can read; loan officers + managers insert
create policy "authenticated_read_borrowers"
  on borrowers for select
  using (auth.role() = 'authenticated');

create policy "lo_manager_insert_borrowers"
  on borrowers for insert
  with check (current_user_role() in ('loan_officer', 'manager'));

-- tax_returns: all authenticated can read; underwriters + managers can modify
create policy "authenticated_read_returns"
  on tax_returns for select
  using (auth.role() = 'authenticated');

create policy "underwriter_manager_upsert_returns"
  on tax_returns for insert
  with check (current_user_role() in ('underwriter', 'manager'));

create policy "underwriter_manager_update_returns"
  on tax_returns for update
  using (current_user_role() in ('underwriter', 'manager'));

create policy "authenticated_delete_returns"
  on tax_returns for delete
  using (auth.role() = 'authenticated');

-- field_overrides: all authenticated can read; underwriters insert their own
create policy "authenticated_read_overrides"
  on field_overrides for select
  using (auth.role() = 'authenticated');

create policy "underwriters_insert_overrides"
  on field_overrides for insert
  with check (
    current_user_role() in ('underwriter', 'manager')
    and overridden_by = auth.uid()
  );

-- income_calculations: all authenticated can read; underwriters insert
create policy "authenticated_read_calculations"
  on income_calculations for select
  using (auth.role() = 'authenticated');

create policy "underwriters_insert_calculations"
  on income_calculations for insert
  with check (current_user_role() in ('underwriter', 'manager'));

-- ─── INDEXES ────────────────────────────────────────────────
create index if not exists idx_borrowers_loan_id       on borrowers(loan_id);
create index if not exists idx_tax_returns_borrower_id on tax_returns(borrower_id);
create index if not exists idx_tax_returns_loan_id     on tax_returns(loan_id);
create index if not exists idx_field_overrides_return  on field_overrides(tax_return_id);
create index if not exists idx_income_calc_loan        on income_calculations(loan_id);
create index if not exists idx_income_calc_borrower    on income_calculations(borrower_id);

-- ─── DONE ────────────────────────────────────────────────────
-- After running this file, run seed.sql to populate demo data.
