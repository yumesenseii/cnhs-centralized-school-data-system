# CNHS Learn — Manual smoke checklist (ISO evidence)

Use this for defense / ISO 25010 reliability & functional suitability notes.  
Sign or initial each row after a live pass. Do **not** invent data.

**Environment:** _________________ (local / Vercel)  
**Date:** _________________  
**Tester:** _________________

| # | Flow | Pass? | Notes |
|---|------|:-----:|-------|
| 1 | **Login** with teacher / HT / student → lands on correct portal | ☐ | |
| 2 | **First-login** (new or reset user): change password + accept Terms → then dashboard | ☐ | Skip if account already completed |
| 3 | **ECR import** (teacher class): upload official class record → roster/grades appear | ☐ | Graded learners only for risk |
| 4 | **Attendance AM/PM**: mark Morning + Afternoon → **Save** → totals update from saved records | ☐ | Unsaved defaults are on-screen only |
| 5 | **Attendance export**: PDF/Excel → **preview** first → Cancel creates no file; confirm says working report (not official DepEd SF2) | ☐ | |
| 6 | **Recommendation** appears on Monitoring after grades (ARAL Learners or Classroom Remedial); honesty note: ECR grades only | ☐ | If ML offline, amber **fallback** banner must show |
| 7 | **ARAL weekly**: facilitator opens section → Week entry → **Save** → persists on refresh | ☐ | Blank session ≠ Absent |
| 8 | **Lesson plan**: teacher submit → HT review (approve or needs revision) | ☐ | |
| 9 | **Notifications**: empty inbox shows next action; after LP submit/review or recommendation event, item appears; Mark as Read works | ☐ | |
| 10 | **Page help**: `?` icon on Dashboard / Attendance / ARAL / Monitoring / Notifications opens right sheet | ☐ | |

## Honest claims (do not overstate)

- Risk / recommendation inputs = **ECR grades only** (not attendance).
- UI labels = **Recommendation**, **Intervention**, **ARAL Learners**, **Classroom Remedial** (no “PLP” in product UI).
- Attendance PDF/Excel = **working report**, not official DepEd SF2.
- No claim of per-category probability scores (P(High)/P(Moderate)/P(Low)) in the UI.

## Optional automation

Repo has **no** test runner (`package.json` has lint/build only). Keep this checklist as primary smoke evidence unless a runner is added later.
