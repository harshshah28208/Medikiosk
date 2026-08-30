# MediKiosk — Quickstart & Demonstration Runbook

## 🏥 Architecture Overview
MediKiosk is a production-quality, multilingual AI healthcare platform with:
- **Patient Kiosk Experience**: Multilingual voice and touch intake (`/kiosk`)
- **Doctor Command Center**: AI summary review & E-Prescriptions (`/doctor`)
- **Nurse Station**: Vitals entry (BP, Pulse, SpO2, BMI) (`/nurse`)
- **Triage Center**: Real-time red flag emergency alerts (`/triage`)
- **AYUSH Center**: Ashtavidha Pariksha & Prakriti analysis (`/ayush`)
- **Administration**: Department analytics & security audit logs (`/admin`)

---

## ⚡ Starting the Application

### 1. Database Setup
MediKiosk uses SQLite for zero-config local development — no Docker or Postgres required.


### 2. Run Database Migrations & Seed Demo Accounts
```bash
cd backend
npx prisma db push
npm run db:seed
```

### 3. Start Backend Server (Port 5000)
```bash
cd backend
npm run dev
```

### 4. Start Frontend Client (Port 5173)
```bash
cd frontend
npm run dev
```

---

## 🔑 Demo Role Credentials (password: `demo123`)

| Role | Demo Email | Workspace URL |
| :--- | :--- | :--- |
| **Patient / Kiosk** | `patient@demo.com` | `http://localhost:5173/kiosk` |
| **Doctor** | `doctor@demo.com` | `http://localhost:5173/doctor` |
| **Nurse** | `nurse@demo.com` | `http://localhost:5173/nurse` |
| **Triage Staff** | `triage@demo.com` | `http://localhost:5173/triage` |
| **AYUSH Doctor** | `ayush@demo.com` | `http://localhost:5173/ayush` |
| **Hospital Admin** | `admin@demo.com` | `http://localhost:5173/admin` |

*(Note: You can also use the one-click role cards on the login page `http://localhost:5173/login`)*

---

## 🧪 Demonstration Test Scenarios

### Scenario 1: Multilingual Voice AI Intake
1. Navigate to `/kiosk` and tap **Start New Visit**.
2. Select **Hindi (हिन्दी)** or **Gujarati (ગુજરાતી)** or **English**.
3. Complete Registration (MRN & Token generated automatically).
4. Review & Accept Informed Consent.
5. In **Intake Screen**, tap the microphone or quick-choice touch buttons.
6. Observe real-time clinical fact extraction and dynamic follow-up questioning.

### Scenario 2: Emergency Red-Flag Trigger
1. Speak or type: `"I have severe chest pain with left arm pain and sweating"` (or Hindi: `"सीने में भारी दर्द और पसीना"`).
2. Observe the red emergency banner triggered instantly.
3. Login as **Triage Staff** (`/triage`) and verify the `CRITICAL` alert broadcast in real-time.

### Scenario 3: Nurse Vitals & Doctor Review
1. Login as **Nurse** (`/nurse`), select the patient, enter vitals (BP: `130/85`, SpO2: `98%`, Pulse: `78`), and click **Record Vitals**.
2. Login as **Doctor** (`/doctor`), review the AI Structured Summary draft, write clinical notes, prescribe medicines, and sign the E-Prescription.
3. Login as **Patient** (`/kiosk/portal`) and view the updated longitudinal timeline.
