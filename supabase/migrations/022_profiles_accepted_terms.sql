-- Record Terms & Privacy acceptance on first login (staff accounts).
alter table public.profiles
  add column if not exists accepted_terms_at timestamptz;

comment on column public.profiles.accepted_terms_at is
  'Set when a teacher or Head Teacher accepts Terms of Use and Privacy Policy on first login.';
