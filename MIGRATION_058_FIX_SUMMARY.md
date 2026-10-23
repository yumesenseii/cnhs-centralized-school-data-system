# CNHS LEARN ARAL Reading Assessment - Fix for Migration 058 Error

## Error Message
> "Reading assessment storage needs an update. Ask the administrator to apply migration 058, then try again."

## Root Cause
The database is missing schema changes from **Migration 058** (`058_aral_independent_periods_and_audit.sql`). The frontend code expects the following database objects that don't exist:

### Missing Database Objects
| Object | Purpose | Migration |
|--------|---------|-----------|
| `phil_iri_baseline_records.assessment_period` | Stores BOSY/MOSY/EOSY per record | 055, repeated in 058 |
| Unique constraint `(student_id, school_year, subject, assessment_period)` | Enables term-aware upserts | 055, repeated in 058 |
| `phil_iri_baseline_records.total_score` nullable | Allows absent learners (no score) | 055, repeated in 058 |
| `monitoring_records.assessment_period` | Links monitoring to reading periods | 058 |
| `can_manage_phil_iri()` function | Validates teacher-class-student access | 058 |
| `validate_and_audit_phil_iri()` trigger | Validates & audits all writes | 058 |
| `phil_iri_assessment_audit` table | Audit trail for corrections | 058 |
| Updated RLS policies | Use `can_manage_phil_iri()` for access control | 058 |

## Files Created/Modified

### 1. Migration Verification Script (NEW)
**File:** `supabase/verify_migration_058.sql`
- Run in Supabase SQL Editor to verify all 14 checks pass
- Each check returns `PRESENT`/`NULLABLE`/`DROPPED`/`UPDATED`/`GRANTED` or `MISSING`/`OLD OR MISSING`

### 2. Frontend Error Notification Fixes
**File:** `components/teacher/monitoring/AralAssessmentFlowModal.jsx`
- Line 344: Changed `showToast(err.message)` → `showToast({ message: err.message, tone: "error" })`
- Ensures red error toast instead of green success

**File:** `components/teacher/aral-program/AralClassGstSpreadsheet.jsx`
- Line 444: Changed `showToast(err?.message)` → `showToast({ message: err?.message, tone: "error" })`
- Fixes batch GST save error notification

**File:** `lib/monitoring/philIriPersistence.js`
- Line 85: Updated error message to include "Error:" keyword
- Auto-detects as error tone in toast system (safety net)

## Verification Steps for Administrator

### Step 1: Check Migration Status
```sql
-- Run in Supabase SQL Editor
\i supabase/verify_migration_058.sql
```
All 14 checks should return `PRESENT`, `NULLABLE`, `DROPPED`, `UPDATED`, or `GRANTED`.

### Step 2: Apply Migration 058 (if needed)
If any checks show `MISSING` or `OLD OR MISSING`:
```sql
-- Run in Supabase SQL Editor (as database administrator)
\i supabase/migrations/058_aral_independent_periods_and_audit.sql
```

### Step 3: Verify Application Works
1. Login as teacher
2. Navigate to **ARAL Reading Assessment** → Select class
3. Enter GST scores or open Individual Reading Assessment (Form 3)
4. Save - should succeed without "migration 058" error
5. Error notifications should show **red** (not green)

## Migration 058 Details
The migration is **idempotent** (safe to run multiple times):
- Uses `IF NOT EXISTS` / `DROP IF EXISTS` / `DO $$ ... IF NOT EXISTS`
- Preserves all existing records (legacy readings stay BOSY)
- No data loss, no destructive operations
- Adds `notify pgrst, 'reload schema'` for PostgREST cache refresh

## Why Error Showed Green Success Toast
The toast system (`components/shared/AppToast.jsx`) auto-detects tone from message content:
```javascript
if (/unable|error|fail|invalid|denied|choose approve|required/i.test(text)) return "error";
```
The original message "Reading assessment storage needs an update..." contained none of these keywords → defaulted to "success" (green).

**Fix:** 
1. Explicit `tone: "error"` passed in components
2. Error message now includes "Error:" keyword for auto-detection

## Affected Components (All Fixed)
| Component | Save Function | Error Toast Fixed |
|-----------|--------------|-------------------|
| `AralAssessmentFlowModal.jsx` | `saveSinglePhilIriResult` | ✅ Line 344 |
| `AralClassGstSpreadsheet.jsx` | `saveBatchClassGstScores` | ✅ Line 444 |
| `PhilIriEnterResultModal.jsx` | `saveSinglePhilIriResult` | Already used `showToast("error", ...)` |
| `StudentMonitoringSidePanel.jsx` | `saveSinglePhilIriResult` | Already used `showToast("error", ...)` |

## No Data Loss
- Migration preserves all existing `phil_iri_baseline_records`
- Legacy records without `assessment_period` get default `'BOSY'`
- All GST, Phil-IRI, BOSY/MOSY/EOSY records preserved
- No reset, no bypass, no destructive operations

## Testing Checklist
- [ ] Run `verify_migration_058.sql` in Supabase
- [ ] Apply migration 058 if needed
- [ ] Teacher: Save GST scores for BOSY class → Success
- [ ] Teacher: Save Individual Reading Assessment (Form 3) → Success  
- [ ] Teacher: Trigger error (e.g., invalid score) → **Red error toast**
- [ ] Teacher: Save draft → "Draft saved locally" (info toast)
- [ ] Admin: Verify audit trail in `phil_iri_assessment_audit`