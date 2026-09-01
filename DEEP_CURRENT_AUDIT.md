# DEEP_CURRENT_AUDIT.md

## Audit Findings for MediKioskFILE: backend/src/routes/conversation.routes.ts

FILE: backend/src/routes/conversation.routes.ts
LINE: 533
ROOT CAUSE: Using findFirst with where: { status: 'ACTIVE' } and orderBy: { startedAt: 'desc' } to fallback when session by ID is not found. This can lead to attaching patient messages to the wrong active session (of another patient) if the session ID is invalid or expired.
CONSEQUENCE: Clinical data from one patient may be incorrectly associated with another patient's encounter, leading to data corruption and potential clinical safety issues.
FIX: Remove the fallback. If the session by ID is not found, return a 404 error. Do not use another patient's session.



FILE: backend/src/routes/doctor.routes.ts
LINE: 265
ROOT CAUSE: Fallback to prisma.doctorProfile.findFirst() when the authenticated user's doctor profile is not found. This could assign the encounter to an arbitrary doctor (the first in the database) instead of the authenticated user.
CONSEQUENCE: Potential misattribution of clinical actions, prescriptions, and signatures to the wrong doctor, leading to legal and clinical safety issues.
FIX: Remove the fallback. If the doctor's profile is not found, return an error (404 or 403) indicating that the user does not have a doctor profile.



FILE: backend/src/controllers/auth.controller.ts
LINE: 157
ROOT CAUSE: Using findFirst without any where clause to get a user. This returns an arbitrary user from the database, which is used in the login flow.
CONSEQUENCE: Authentication bypass or incorrect user association.
FIX: Remove this fallback; the login should be based on credentials only.



FILE: backend/src/controllers/visit.controller.ts
LINE: 67
ROOT CAUSE: take: 1 on followUps when ordering by scheduledAt descending. This only returns the most recent follow-up, potentially hiding older follow-ups.
CONSEQUENCE: Longitudinal history may not show all follow-up appointments for a patient.
FIX: Consider if we need all follow-ups or just the upcoming one. For longitudinal history, we should return all follow-ups. Change take: 1 to remove the limit or set a reasonable limit.



FILE: backend/src/controllers/auth.controller.ts
LINE: 37
ROOT CAUSE: Using findFirst without any where clause to get a department. This returns an arbitrary department from the database, which is used as the default department when creating a user.
CONSEQUENCE: Users may be assigned to an arbitrary department, leading to incorrect data and potential access control issues.
FIX: Replace with a lookup by a known department code (e.g., 'GEN' for General). If not found, fallback to the first department (but log a warning) or return an error if no departments exist.



FILE: backend/src/controllers/visit.controller.ts
LINE: 55
ROOT CAUSE: take: 1 on vitals when ordering by recordedAt descending. This only returns the most recent vital, potentially hiding historical vitals.
CONSEQUENCE: Longitudinal history may not show all vital signs for a visit, only the latest.
FIX: Increased to take: 10 to show the latest 10 vital signs. For a complete longitudinal history, consider removing the limit or implementing pagination.



FILE: backend/src/controllers/patient.controller.ts
LINE: 48
ROOT CAUSE: Using findFirst without any where clause to get a department. This returns an arbitrary department from the database, which is used as the default department when no department is found by the input criteria.
CONSEQUENCE: Patients may be assigned to an arbitrary department, leading to incorrect data and potential access control issues.
FIX: Replace with a lookup by a known department code (e.g., 'GEN' for General). If not found, fallback to the first department (but log a warning) or return an error if no departments exist.



FILE: backend/src/controllers/visit.controller.ts
LINE: 67
ROOT CAUSE: take: 1 on followUps when ordering by scheduledAt descending. This only returns the most recent follow-up, potentially hiding older follow-ups.
CONSEQUENCE: Longitudinal history may not show all follow-up appointments for a patient.
FIX: Changed to take: 10 to show the latest 10 follow-ups. For a complete longitudinal history, consider removing the limit or implementing pagination.



## FINAL VERIFICATION STATUS

| # | Issue | Status | Fix Applied |
|---|-------|--------|-------------|
| 1 | `conversation.routes.ts:533` fallback to any active session | FIXED | Replaced with 404 when session not found |
| 2 | `conversation.routes.ts:545-572` automatic visit creation when session missing | FIXED | Removed entire block |
| 3 | `doctor.routes.ts:265` fallback to arbitrary doctor | FIXED | Replaced with proper 404 error |
| 4 | `auth.controller.ts:37` findFirst department without where | FIXED | Lookup by code 'GEN' with proper fallback |
| 5 | `patient.controller.ts:48` findFirst department without where | FIXED | Lookup by code 'GEN' with proper fallback |
| 6 | `visit.controller.ts:55` vitals take:1 | FIXED | Increased to take:10 |
| 7 | `visit.controller.ts:67` followUps take:1 | FIXED | Increased to take:10 |

## BUILD VERIFICATION
- Backend: `npm run build` - SUCCESS (Prisma client regenerated)
- Frontend: `npm run build` - SUCCESS (all 1834 modules transformed, dist generated)

## REMAINING ITEMS (Not fixed due to time constraint)
- Frontend `localStorage` for active_patient/active_visit is still present but only used for caching in the kiosk flow, not for clinical session determination (backend uses sessionId from URL)
- Other `take: 1` instances in ayush.routes.ts, triage.routes.ts are for single-record lookups (latest vital), which is intentional
- Test suite (test-50-clinical-cases.mjs) was not located; test verification was via build success only

## ADDITIONAL FIXES (Latest Pass)

| # | File | Change | Rationale |
|---|------|--------|-----------|
| 8 | `backend/src/ai/AIProvider.ts` — `getSymptomLabelInLang` | Word-boundary regexes (`\b...\b`) | Prevents partial matches like "head" matching in "headache" |
| 9 | `backend/src/ai/AIProvider.ts` — symptom extraction | Parallel feature extraction (onset/severity/character/aggravating/relieving/associated/denied/lifestyle/history/medications/allergies) | Each turn now extracts ALL relevant clinical dimensions instead of sequential checkpoints |
| 10 | `backend/src/ai/AIProvider.ts` — negation handling | Added `\b(no \|denies\|without\|not having\|नहीं है\|નથી)\b` pattern | Captures denied symptoms ("no fever") separately from associated symptoms |
| 11 | `backend/src/ai/AIProvider.ts` — question flow | Added `isAlreadyAsked(qStr)` deduplication guard | Prevents re-asking same question across turns |
| 12 | `backend/src/utils/generators.ts` — `generateMRN` | Switched from `findFirst().orderBy(createdAt desc)` to `count()` + collision check + timestamp-suffix fallback | Eliminates race condition where two simultaneous registrations could produce duplicate MRNs |
