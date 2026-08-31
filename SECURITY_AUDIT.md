# SECURITY & AUTHORIZATION AUDIT (Phase 7)

**MediKiosk Autonomous Clinical Intake AI — Backend Authorization, IDOR & RBAC Security Verification**  
*Date: 2026-08-31 | Status: ALL 19 PENETRATION SCENARIOS VERIFIED SAFE (100% PASS)*

---

## Executive Summary

Phase 7 conducted a comprehensive backend security and authorization penetration audit across the MediKiosk platform. Authorization is enforced strictly in the **backend / database layer**, independent of frontend route guards.

### Security Architecture Enforced:
1. **Zero Trust JWT Validation**: All authenticated requests cryptographically verify signatures against `JWT_SECRET` and confirm active user status in `prisma.user`.
2. **Invariable IDOR Protection**: Patients cannot manipulate URLs or entity IDs to access another patient's visits, medical records, PDF extractions, e-prescriptions, or longitudinal timelines.
3. **Role-Based Access Control (RBAC)**:
   - **PATIENT**: Can only access their own patient profile, own visits, and own documents. Cannot access doctor queues, draft summaries, or mutate clinical states.
   - **NURSE & TRIAGE**: Can record triage vitals and view department queue, but are blocked from signing consultations or issuing prescriptions.
   - **DOCTOR**: Authorized to review clinical drafts, edit diagnoses, and digitally sign e-prescriptions. Blocked from system administrative logs.
   - **HOSPITAL_ADMIN / SUPER_ADMIN**: Authorized for system audit logs, user provisioning, and operational dashboards.
4. **Anonymous Guarding**: All clinical and patient data endpoints return `401 Unauthorized` when called without valid authorization headers.

---

## Detailed Penetration Test Matrix & Concrete Evidence

| Category | Vulnerability Target | Attack Vector Tested | Response & Evidence | Status |
|---|---|---|---|---|
| **IDOR** | **Patient $\rightarrow$ Another Patient Visit** | `patient@demo.com` attempts `GET /api/visits/:patientB_visitId` | `HTTP 403 Forbidden` — `{"error":"Access denied. You can only view your own visits."}` | `VERIFIED SAFE` |
| **IDOR** | **Patient $\rightarrow$ Another Patient Profile** | `patient@demo.com` attempts `GET /api/patients/:patientB_id` | `HTTP 403 Forbidden` — `{"error":"Access denied. Required roles: DOCTOR, SPECIALIST_DOCTOR, AYUSH_DOCTOR, NURSE, TRIAGE_STAFF. Your role: PATIENT"}` | `VERIFIED SAFE` |
| **IDOR** | **Patient $\rightarrow$ Another Patient Documents** | `patient@demo.com` attempts `GET /api/documents/:patientB_id` | `HTTP 403 Forbidden` — `{"error":"Access denied. You can only view your own documents."}` | `VERIFIED SAFE` |
| **IDOR** | **Patient $\rightarrow$ Another Patient Timeline** | `patient@demo.com` attempts `GET /api/documents/timeline/:patientB_id` | `HTTP 403 Forbidden` — `{"error":"Access denied. You can only view your own longitudinal history."}` | `VERIFIED SAFE` |
| **IDOR** | **Patient $\rightarrow$ Global Visit List Leakage** | `patient@demo.com` queries `GET /api/visits` | `HTTP 200 OK` — Response filtered strictly to Patient A's own 2 visits. Patient B records = `0` (Zero leak). | `VERIFIED SAFE` |
| **RBAC** | **Patient $\rightarrow$ Doctor OPD Queue** | `patient@demo.com` attempts `GET /api/doctor/patients` | `HTTP 403 Forbidden` — `{"error":"Access denied. Required roles: DOCTOR, SPECIALIST_DOCTOR, AYUSH_DOCTOR, NURSE, TRIAGE_STAFF. Your role: PATIENT"}` | `VERIFIED SAFE` |
| **RBAC** | **Patient $\rightarrow$ Doctor AI Summary Draft** | `patient@demo.com` attempts `GET /api/doctor/summary/:visitId` | `HTTP 403 Forbidden` — `{"error":"Access denied. Required roles: DOCTOR, SPECIALIST_DOCTOR, AYUSH_DOCTOR, NURSE, TRIAGE_STAFF. Your role: PATIENT"}` | `VERIFIED SAFE` |
| **RBAC** | **Patient $\rightarrow$ Doctor Prescription Signing** | `patient@demo.com` attempts `POST /api/doctor/consultation` | `HTTP 403 Forbidden` — `{"error":"Access denied. Required roles: DOCTOR, SPECIALIST_DOCTOR, AYUSH_DOCTOR. Your role: PATIENT"}` | `VERIFIED SAFE` |
| **RBAC** | **Patient $\rightarrow$ Visit Status Mutation** | `patient@demo.com` attempts `PATCH /api/visits/:id/status` | `HTTP 403 Forbidden` — `{"error":"Access denied. Required roles: DOCTOR, SPECIALIST_DOCTOR, AYUSH_DOCTOR, NURSE, TRIAGE_STAFF. Your role: PATIENT"}` | `VERIFIED SAFE` |
| **RBAC** | **Patient $\rightarrow$ Doctor Auto-Assignment** | `patient@demo.com` attempts `POST /api/visits/:id/assign-doctor` | `HTTP 403 Forbidden` — `{"error":"Access denied. Required roles: DOCTOR, SPECIALIST_DOCTOR, AYUSH_DOCTOR, NURSE, TRIAGE_STAFF. Your role: PATIENT"}` | `VERIFIED SAFE` |
| **RBAC** | **Nurse $\rightarrow$ Doctor Consultation Signing** | `nurse@demo.com` attempts `POST /api/doctor/consultation` | `HTTP 403 Forbidden` — `{"error":"Access denied. Required roles: DOCTOR, SPECIALIST_DOCTOR, AYUSH_DOCTOR. Your role: NURSE"}` | `VERIFIED SAFE` |
| **Clinical** | **Nurse $\rightarrow$ Clinical Triage Vitals** | `nurse@demo.com` calls `POST /api/vitals` | `HTTP 201 Created` — `{"vital":{"id":"e94b93fe-a591-4f97-9957-bed87a281111"}}` (Legitimate clinical workflow allowed). | `VERIFIED SAFE` |
| **Admin** | **Doctor $\rightarrow$ Admin Audit Logs** | `doctor@demo.com` attempts `GET /api/admin/audit-logs` | `HTTP 403 Forbidden` — `{"error":"Access denied. Required roles: HOSPITAL_ADMIN, SUPER_ADMIN. Your role: DOCTOR"}` | `VERIFIED SAFE` |
| **Admin** | **Nurse $\rightarrow$ System User List** | `nurse@demo.com` attempts `GET /api/admin/users` | `HTTP 403 Forbidden` — `{"error":"Access denied. Required roles: HOSPITAL_ADMIN, SUPER_ADMIN. Your role: NURSE"}` | `VERIFIED SAFE` |
| **Admin** | **Admin $\rightarrow$ Hospital Audit Logs** | `admin@demo.com` calls `GET /api/admin/audit-logs` | `HTTP 200 OK` — `{"logs": [...], "pagination": {"total": 169}}` (Authorized administrative role). | `VERIFIED SAFE` |
| **Anon** | **Anonymous $\rightarrow$ Visit Record** | `GET /api/visits/:id` with no token | `HTTP 401 Unauthorized` — `{"error":"Authentication required. Please provide a valid token."}` | `VERIFIED SAFE` |
| **Anon** | **Anonymous $\rightarrow$ Doctor Queue** | `GET /api/doctor/patients` with no token | `HTTP 401 Unauthorized` — `{"error":"Authentication required. Please provide a valid token."}` | `VERIFIED SAFE` |
| **Anon** | **Anonymous $\rightarrow$ Patient Documents** | `GET /api/documents/:patientId` with no token | `HTTP 401 Unauthorized` — `{"error":"Authentication required. Please provide a valid token."}` | `VERIFIED SAFE` |
| **Anon** | **Anonymous $\rightarrow$ Vitals Submission** | `POST /api/vitals` with no token | `HTTP 401 Unauthorized` — `{"error":"Authentication required. Please provide a valid token."}` | `VERIFIED SAFE` |

---

## Fixes Implemented During Audit

1. **`backend/src/routes/visit.routes.ts`**:
   - Fixed missing clinical role guards on `PATCH /api/visits/:id/status` and `POST /api/visits/:id/assign-doctor` by wrapping with `requireClinicalRole()`.
2. **`backend/src/controllers/visit.controller.ts`**:
   - Fixed IDOR vulnerability in `getVisit` by enforcing patient ID ownership check.
   - Fixed IDOR list leakage in `listVisits` by auto-scoping patient queries to their own `patientId`.
3. **`backend/src/routes/document.routes.ts`**:
   - Replaced unauthenticated `optionalAuth` on `GET /api/documents/:patientId` and `GET /api/documents/timeline/:patientId` with mandatory `authenticateToken`.
   - Added patient ownership verification so patients can only read their own document records and timelines.

---

## Code References
- Authentication Middleware: [auth.ts](file:///c:/Users/DELL/OneDrive/Desktop/Demo-msu/backend/src/middleware/auth.ts)
- Role-Based Access Control Middleware: [rbac.ts](file:///c:/Users/DELL/OneDrive/Desktop/Demo-msu/backend/src/middleware/rbac.ts)
- Visit Controller & IDOR Protection: [visit.controller.ts](file:///c:/Users/DELL/OneDrive/Desktop/Demo-msu/backend/src/controllers/visit.controller.ts#L75-L160)
- Document & Timeline Authorization: [document.routes.ts](file:///c:/Users/DELL/OneDrive/Desktop/Demo-msu/backend/src/routes/document.routes.ts#L246-L345)
- Automated Security Penetration Suite: [test-security-authorization.mjs](file:///c:/Users/DELL/OneDrive/Desktop/Demo-msu/backend/test-security-authorization.mjs)
