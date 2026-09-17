# CNHS Learn — Backup & restore one-pager (defense)

School-scale notes for ISO recoverability. Stack: **Supabase** (Postgres + Auth + Storage) + **Vercel** (Next.js frontend) + optional **FastAPI** ML service (stateless inference).

**Do not run destructive restore commands during a live demo unless the project owner has approved a maintenance window.**

---

## What holds the data?

| Asset | Where it lives | Backed up by |
|-------|----------------|--------------|
| Learner grades, ECR, attendance, monitoring, lesson-plan metadata, profiles | Supabase **Postgres** | Supabase project backups (plan-dependent) |
| Auth users / passwords | Supabase **Auth** | Tied to the same project |
| Lesson plan files (and similar uploads) | Supabase **Storage** (e.g. `lesson-plans` bucket) | Storage objects in the project; include in restore planning |
| App code / env config | Git repo + Vercel project env | Git history + Vercel redeploy |
| RF model weights / ML service | Separate host or local `ml-service` | Not the school DB; redeploy / retrain as needed |
| Email (welcome / reset) | Brevo (external) | Provider logs only; not school DB |

Frontend on Vercel is **stateless** relative to learner data. Losing the Vercel deploy does **not** delete grades if Supabase is intact. Losing Supabase **does**.

---

## Who can restore?

| Role | Can restore? |
|------|----------------|
| **Supabase project owner / org admin** | Yes — dashboard backups, PITR (if plan), Storage |
| **Vercel project owner** | Redeploy app; restore env vars from team secrets |
| Head Teacher (app role) | **No** production DB restore from inside CNHS Learn |
| Teachers / students | No |

---

## Honest RPO / RTO (school pilot scale)

These are **planning targets**, not a contractual SLA.

| Metric | Honest school-scale note |
|--------|---------------------------|
| **RPO** (how much data you might lose) | Depends on Supabase plan: daily backups → up to ~24h; PITR (Pro+) → minutes. Confirm in your project’s Backup settings. |
| **RTO** (time to be usable again) | Typically hours: verify backup → restore DB → confirm Storage → redeploy Vercel → smoke login. Not “instant failover.” |
| **ML down** | App continues with **rule-based recommendation fallback** (see Monitoring honesty banner). Not a data-loss event. |

---

## Backup checklist (project owner)

1. Open **Supabase Dashboard → Project → Database → Backups** (wording may vary by plan).  
2. Confirm automatic backups are **enabled** and note retention days.  
3. If on a plan with **Point-in-Time Recovery**, note the window.  
4. List Storage buckets used in production (`lesson-plans`, any attendance/ECR uploads).  
5. Export or document **Vercel env** names (not secret values in the thesis PDF): `NEXT_PUBLIC_SUPABASE_URL`, anon key pattern, service role only on Edge Functions / server.  
6. Keep a signed copy of this page + last backup confirmation date: __________  

---

## Restore checklist (maintenance window only)

1. **Freeze writes** if possible (announce to staff; avoid mid-ECR-publish restore).  
2. Restore Postgres from the chosen backup / PITR timestamp in Supabase (owner UI).  
3. Confirm Auth users still match `profiles.auth_user_id` expectations.  
4. Verify Storage objects for a sample lesson plan file.  
5. Redeploy or soft-refresh the Vercel app; clear CDN only if needed.  
6. Run smoke tests from `docs/SMOKE_CHECKLIST.md` (login, one ECR class, attendance save, one LP open).  
7. Record restore time and outcome for the defense folder.

**Never** paste production service-role keys into client code or thesis screenshots.

---

## What this document is not

- Not a guarantee of zero data loss  
- Not a substitute for DepEd records retention policies for paper / official SF2  
- Not instructions to wipe or recreate a live school project casually
