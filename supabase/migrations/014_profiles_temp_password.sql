-- Store admin-generated temporary passwords for teacher Settings display.
-- Cleared after the user successfully changes their password.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists temp_password text;

comment on column public.profiles.must_change_password is
  'True when account still uses an admin-generated temporary password.';
comment on column public.profiles.temp_password is
  'Plaintext temporary password for display until the user changes it. Cleared after change.';
