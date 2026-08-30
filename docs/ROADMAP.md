# Roadmap

## ASR (Speech Recognition)
Current: Browser Web Speech API (Chrome only, EN/HI/GU).
Planned: AI4Bharat / Bhashini pipeline API integration for higher accuracy in noisy hospital
environments and full regional language + accent coverage. Requires Bhashini API credentials
(apply at https://bhashini.gov.in). Integration point: `frontend/src/services/speech.ts`,
add a `BhashiniASRProvider` alongside the existing browser provider, with automatic fallback
to Web Speech API if the Bhashini call fails or no API key is configured.

## ABDM / FHIR / HIS Integration
Current: Adapters in `backend/src/integrations/abdm/ABDMAdapter.ts` and
`backend/src/integrations/his/HISAdapter.ts` are built and sandbox-ready but report
`SANDBOX_READY_PENDING_CREDENTIALS` since no live ABDM sandbox credentials are configured.
Planned: Complete ABDM sandbox onboarding, configure `ABDM_CLIENT_ID` / `ABDM_CLIENT_SECRET`,
and enable live ABHA authentication + HIE push.
