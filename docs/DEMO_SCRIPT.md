# MediKiosk Live Demonstration Script

This runbook guides evaluators and presenters through an end-to-end demonstration of the MediKiosk platform, including multilingual AI intake, real-time emergency triage escalation, AYUSH clinical assessment, and doctor consultation.

---

## 1. Demo User Accounts & Login Credentials

All demo accounts share the password: **`demo123`**

| Role | Demo Email | Password | Primary Workspace Route |
| :--- | :--- | :--- | :--- |
| **Patient / Kiosk** | `patient@demo.com` | `demo123` | `http://localhost:5173/kiosk` |
| **Doctor** | `doctor@demo.com` | `demo123` | `http://localhost:5173/doctor` |
| **Nurse** | `nurse@demo.com` | `demo123` | `http://localhost:5173/nurse` |
| **Triage Staff** | `triage@demo.com` | `demo123` | `http://localhost:5173/triage` |
| **AYUSH Doctor** | `ayush@demo.com` | `demo123` | `http://localhost:5173/ayush` |
| **Hospital Admin** | `admin@demo.com` | `demo123` | `http://localhost:5173/admin` |

*(Note: One-click quick-login role cards are also available on the login page at `http://localhost:5173/login`)*

---

## 2. Red-Flag Emergency Phrases

To test context-aware emergency detection and real-time triage escalation, speak or type any of the following exact phrases at the kiosk intake screen:

### English
- `"I have severe chest pain with left arm pain and sweating"`
- `"I have crushing chest pain radiating to my left arm."`
- `"I suddenly cannot move my right arm and my speech is slurred."` *(Stroke / F.A.S.T.)*

### Hindi (हिन्दी)
- `"सीने में भारी दर्द और पसीना"`
- `"सीने में तेज दर्द और सांस लेने में तकलीफ"`

### Gujarati (ગુજરાતી)
- `"છાતીમાં દુખાવો અને ડાબા હાથમાં દુખાવો"`
- `"છાતીમાં ભારે દુખાવો અને પરસેવો"`

---

## 3. Real-Time Socket.io Triage Alert Demonstration

To observe the real-time emergency broadcast:

1. **Open Device / Tab 1 (Triage Desk):**  
   Log in as **Triage Staff** (`triage@demo.com` / `demo123`) and navigate to `http://localhost:5173/triage`. Leave this tab open.

2. **Open Device / Tab 2 (Patient Kiosk):**  
   Navigate to `http://localhost:5173/kiosk`, start a new intake, and enter one of the emergency phrases above (e.g. `"I have severe chest pain with left arm pain and sweating"`).

3. **Observe Real-Time Escalation:**  
   The backend `RedFlagEngine` evaluates the clinical context and instantly broadcasts an `emergency_alert` event across Socket.io.  
   The Triage Dashboard on Tab 1 immediately displays the high-priority `CRITICAL` alert banner and plays the audible siren without requiring a page refresh.
