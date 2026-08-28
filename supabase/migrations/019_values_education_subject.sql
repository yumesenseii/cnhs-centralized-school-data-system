insert into public.subjects (subject_name, subject_code)
select 'Values Education', 'VE'
where not exists (
  select 1
  from public.subjects
  where lower(subject_name) = 'values education'
);
