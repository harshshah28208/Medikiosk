import type { ClinicalState } from './ClinicalState.js';

export interface RedFlagAlert {
  type: string;
  severity: 'HIGH' | 'CRITICAL';
  symptoms: string;
  description: string;
  patientNotice: Record<'EN' | 'HI' | 'GU', string>;
}

export class RedFlagEngine {
  /**
   * Evaluates text and clinical state with strict context-awareness:
   * 1. Filters out third-party statements ("my friend", "my father", "my mother", "he has", "she has")
   * 2. Filters out direct negations ("no chest pain", "do not have", "not feeling")
   * 3. Filters out historical/past episodes ("last year", "months ago", "in 2020")
   * 4. Triggers true positive emergencies conservatively when the patient actively suffers from the symptom.
   */
  static evaluate(state: ClinicalState, rawText: string = ''): RedFlagAlert[] {
    const alerts: RedFlagAlert[] = [];

    const textToEvaluate = (rawText || state.chiefComplaintOriginal || state.chiefComplaint || '').toLowerCase().trim();

    if (!textToEvaluate || textToEvaluate.length < 3) {
      return alerts;
    }

    // ── 1. NEGATION & THIRD-PARTY / HISTORICAL FILTER ──────────────────
    const isThirdParty = /\b(my friend|my father|my mother|my brother|my sister|my wife|my husband|my son|my daughter|my neighbor|someone else|he had|she had|he has|she has|father had|mother had|friend had|મારા પિતા|મારા મિત્ર|મારા ભાઈ|મારા માતા|મેરે पिता|मेरे दोस्त|मेरे भाई)\b/i.test(textToEvaluate);
    
    const isDirectNegation = /\b(no |not |don't |dont |do not |never |without |denies |નથી|કોઈ દુખાવો નથી|नहीं है|दर्द नहीं)\b/i.test(textToEvaluate);
    
    const isHistoricalPast = /\b(i had|had .* last year|had .* years ago|had .* months ago|last year|years ago|months ago|in childhood|past year|2 years ago|गए साल|પહેલા હતું|ગયા વર્ષે)\b/i.test(textToEvaluate);

    // If third-party, negated, or historical-only context, suppress emergency alert
    if (isThirdParty || isDirectNegation || isHistoricalPast) {
      return alerts;
    }

    // ── 2. ACUTE CORONARY SYNDROME / CARDIAC EMERGENCY ────────────────
    const hasChestPain =
      /\b(chest pain|chest tightness|pressure in chest|crushing chest|angina)\b|सीने में.*दर्द|सीने में दर्द|छाती में.*दर्द|छाती में दर्द|છાતીમાં દુખાવો|છાતીમાં દબાણ|છાતીમાં.*દુખાવો/i.test(textToEvaluate);

    const hasCardiacAssociated =
      /\b(breath|shortness of breath|sweat|diaphoresis|left arm|jaw|radiat)\b|सांस|पसीना|શ્વાસ|પરસેવો|ડાબા હાથ|ડાબા.*હાથ/i.test(textToEvaluate);

    if (hasChestPain && hasCardiacAssociated) {
      alerts.push({
        type: 'CARDIAC_EMERGENCY',
        severity: 'CRITICAL',
        symptoms: 'Chest discomfort with radiating pain, dyspnea, or diaphoresis',
        description: 'Possible acute coronary syndrome (ACS) / myocardial ischemia pattern.',
        patientNotice: {
          EN: 'Your responses indicate acute chest symptoms requiring immediate attention. Hospital triage staff have been notified.',
          HI: 'आपके लक्षण गंभीर हृदय/सीने की समस्या का संकेत देते हैं। कृपया तुरंत नजदीकी अस्पताल स्टाफ से संपर्क करें।',
          GU: 'તમારા લક્ષણો છાતીના ગંભીર દુખાવાનો સંકેત આપે છે. કૃપા કરીને તાત્કાલિક હોસ્પિટલ સ્ટાફનો સંપર્ક કરો.',
        },
      });
    } else if (hasChestPain) {
      alerts.push({
        type: 'CHEST_PAIN_ALERT',
        severity: 'HIGH',
        symptoms: 'Active acute chest pain reported',
        description: 'Substernal chest pain reported — ECG priority triage evaluation recommended.',
        patientNotice: {
          EN: 'Chest discomfort reported. Triage staff will prioritize your ECG and evaluation.',
          HI: 'सीने में दर्द की सूचना मिली है। क्लिनिकल स्टाफ आपकी जांच को प्राथमिकता देगा।',
          GU: 'છાતીમાં દુખાવાની નોંધ લેવામાં આવી છે. ડૉક્ટરની ટીમ તરત જ તપાસ કરશે.',
        },
      });
    }

    // ── 3. ACUTE NEUROLOGICAL / STROKE (F.A.S.T.) ─────────────────────
    const hasStrokeSigns =
      /\b(facial droop|slurred speech|cannot move.*arm|cannot move.*leg|sudden weakness|paralysis|facial weakness|लकवा|बोली लड़खड़ाना|अचानक कमजोरी|લકવો|મોં વાંકું|બોલવામાં તકલીફ)\b/i.test(textToEvaluate);

    if (hasStrokeSigns) {
      alerts.push({
        type: 'NEUROLOGICAL_EMERGENCY',
        severity: 'CRITICAL',
        symptoms: 'F.A.S.T. acute neurological deficit reported',
        description: 'Acute focal neurological deficit / suspected stroke pattern.',
        patientNotice: {
          EN: 'Sudden neurological symptoms reported. Immediate physician evaluation is required.',
          HI: 'अचानक न्यूरोलॉजिकल लक्षण पाए गए हैं। तुरंत आपातकालीन जांच की आवश्यकता है।',
          GU: 'અચાનક ન્યુરોલોજીકલ લક્ષણો જણાયા છે. તાત્કાલિક ઇમરજન્સી તપાસ જરૂરી છે.',
        },
      });
    }

    // ── 4. SEVERE RESPIRATORY FAILURE ──────────────────────────────────
    const hasRespiratoryEmergency =
      /\b(gasping|cannot breathe|severe breathlessness|suffocating|turning blue|सांस नहीं आ रही|दम घुट रहा है|શ્વાસ રુંધાવો|શ્વાસ નથી લેવાતો)\b/i.test(textToEvaluate);

    if (hasRespiratoryEmergency) {
      alerts.push({
        type: 'RESPIRATORY_EMERGENCY',
        severity: 'CRITICAL',
        symptoms: 'Severe acute respiratory distress',
        description: 'Impending acute respiratory failure warning.',
        patientNotice: {
          EN: 'Severe breathing difficulty reported. Oxygen & nursing team alerted.',
          HI: 'सांस लेने में भारी तकलीफ दर्ज हुई है। नर्सिंग टीम को अलर्ट भेजा गया है।',
          GU: 'શ્વાસ લેવામાં ભારે મુશ્કેલી છે. નર્સિંગ સ્ટાફને સૂચિત કરવામાં આવ્યા છે.',
        },
      });
    }

    // ── 5. SYNCOPE & LOSS OF CONSCIOUSNESS ────────────────────────────
    const hasSyncope =
      /\b(unconscious|passed out|blacked out|blackout|fainted|বেহোশ|बेहोश|ચક્કર આવીને પડી જવું|બેભાન)\b/i.test(textToEvaluate);

    if (hasSyncope) {
      alerts.push({
        type: 'SYNCOPE_ALERT',
        severity: 'HIGH',
        symptoms: 'Transient loss of consciousness / syncope',
        description: 'Syncope episode reported — assess hemodynamic stability.',
        patientNotice: {
          EN: 'Fainting / loss of consciousness reported. Triage will assist you immediately.',
          HI: 'बेहोशी का प्रकरण दर्ज हुआ है। अस्पताल स्टाफ आपकी सहायता के लिए आ रहा है।',
          GU: 'બેભાન થવાની વિગત નોંધાઈ છે. સ્ટાફ તાત્કાલિક સહાય કરશે.',
        },
      });
    }

    // ── 6. ACTIVE HEMORRHAGE / BLEEDING ───────────────────────────────
    const hasHemorrhage =
      /\b(heavy bleeding|bleeding heavily|coughing blood|vomiting blood|खून की उल्टी|खांसी में खून|લોહીની ઉલટી|લોહી વહેવું)\b/i.test(textToEvaluate);

    if (hasHemorrhage) {
      alerts.push({
        type: 'HEMORRHAGE_EMERGENCY',
        severity: 'CRITICAL',
        symptoms: 'Active hemorrhage or hemoptysis reported',
        description: 'Significant active bleeding reported.',
        patientNotice: {
          EN: 'Active bleeding reported. Emergency clinical team notified.',
          HI: 'रक्तस्राव की सूचना मिली है। आपातकालीन टीम को सूचित कर दिया गया है।',
          GU: 'લોહી વહેવાની વિગત નોંધાઈ છે. ઇમરજન્સી ટીમ મદદ કરશે.',
        },
      });
    }

    return alerts;
  }

  /**
   * Evaluates measured vitals for abnormal thresholds / hemodynamic instability.
   */
  static evaluateVitals(vitals: any): RedFlagAlert[] {
    const alerts: RedFlagAlert[] = [];
    if (!vitals) return alerts;

    // 1. Oxygen Saturation (SpO2)
    if (vitals.spo2 !== undefined && vitals.spo2 !== null && vitals.spo2 > 0) {
      if (vitals.spo2 < 90) {
        alerts.push({
          type: 'SEVERE_HYPOXIA',
          severity: 'CRITICAL',
          symptoms: `Critically low oxygen saturation (SpO2: ${vitals.spo2}%)`,
          description: `Severe hypoxemia detected (SpO2 < 90%). Immediate supplemental oxygen and respiratory evaluation required.`,
          patientNotice: {
            EN: `Oxygen saturation is low (${vitals.spo2}%). Nursing team will assist with oxygen support.`,
            HI: `ऑक्सीजन स्तर कम (${vitals.spo2}%) पाया गया है। नर्सिंग स्टाफ तुरंत सहायता करेगा।`,
            GU: `ઓક્સિજન સ્તર ઓછું (${vitals.spo2}%) છે. નર્સિંગ સ્ટાફ તાત્કાલિક મદદ કરશે.`,
          },
        });
      } else if (vitals.spo2 < 94) {
        alerts.push({
          type: 'HYPOXIA_WARNING',
          severity: 'HIGH',
          symptoms: `Borderline low oxygen saturation (SpO2: ${vitals.spo2}%)`,
          description: `Suboptimal oxygenation (SpO2 < 94%). Monitor respiratory status closely.`,
          patientNotice: {
            EN: `Oxygen level is slightly low (${vitals.spo2}%). Please rest while triage evaluates.`,
            HI: `ऑक्सीजन का स्तर थोड़ा कम है (${vitals.spo2}%)। कृपया आराम से बैठें।`,
            GU: `ઓક્સિજન સ્તર થોડું ઓછું છે (${vitals.spo2}%). કૃપા કરીને આરામ કરો.`,
          },
        });
      }
    }

    // 2. Blood Pressure (Hypertensive Crisis / Hypotension Shock)
    if (vitals.bpSystolic || vitals.bpDiastolic) {
      const sys = vitals.bpSystolic || 0;
      const dia = vitals.bpDiastolic || 0;

      if (sys >= 180 || dia >= 120) {
        alerts.push({
          type: 'HYPERTENSIVE_CRISIS',
          severity: 'CRITICAL',
          symptoms: `Hypertensive crisis reading (BP: ${sys}/${dia} mmHg)`,
          description: `Severe blood pressure elevation (Systolic >= 180 or Diastolic >= 120 mmHg). Risk of acute end-organ damage.`,
          patientNotice: {
            EN: `Blood pressure reading is significantly elevated (${sys}/${dia} mmHg). Doctor review is prioritized.`,
            HI: `रक्तचाप बहुत अधिक (${sys}/${dia} mmHg) है। डॉक्टर की जांच को प्राथमिकता दी गई है।`,
            GU: `બ્લડ પ્રેશર ઘણું ઊંચું (${sys}/${dia} mmHg) છે. ડૉક્ટર તાત્કાલિક તપાસ કરશે.`,
          },
        });
      } else if (sys > 0 && sys < 90) {
        alerts.push({
          type: 'HYPOTENSION_ALERT',
          severity: 'HIGH',
          symptoms: `Severe hypotension (BP: ${sys}/${dia} mmHg)`,
          description: `Hypotension detected (Systolic < 90 mmHg). Screen for hemodynamic instability, dehydration, or septic etiology.`,
          patientNotice: {
            EN: `Blood pressure is low (${sys}/${dia} mmHg). Clinical staff will evaluate your hydration status.`,
            HI: `रक्तचाप कम (${sys}/${dia} mmHg) पाया गया है। स्टाफ आपकी स्थिति की जांच करेगा।`,
            GU: `બ્લડ પ્રેશર ઓછું (${sys}/${dia} mmHg) છે. સ્ટાફ યોગ્ય તપાસ કરશે.`,
          },
        });
      }
    }

    // 3. Heart Rate (Severe Tachycardia / Bradycardia)
    if (vitals.pulse !== undefined && vitals.pulse !== null && vitals.pulse > 0) {
      if (vitals.pulse > 130) {
        alerts.push({
          type: 'SEVERE_TACHYCARDIA',
          severity: 'HIGH',
          symptoms: `Severe tachycardia (Pulse: ${vitals.pulse} bpm)`,
          description: `Marked tachycardia (> 130 bpm). Assess for arrhythmia, fever, pain, or hemodynamic compensation.`,
          patientNotice: {
            EN: `Heart rate is elevated (${vitals.pulse} bpm). Resting ECG may be performed.`,
            HI: `हार्ट रेट अधिक (${vitals.pulse} bpm) है। डॉक्टर तुरंत जांच करेंगे।`,
            GU: `ધબકારા વધુ (${vitals.pulse} bpm) છે. ડૉક્ટર તરત તપાસ કરશે.`,
          },
        });
      } else if (vitals.pulse < 45) {
        alerts.push({
          type: 'SEVERE_BRADYCARDIA',
          severity: 'HIGH',
          symptoms: `Marked bradycardia (Pulse: ${vitals.pulse} bpm)`,
          description: `Severe bradycardia (< 45 bpm). Assess for heart block, conduction defects, or medication effect.`,
          patientNotice: {
            EN: `Heart rate is very slow (${vitals.pulse} bpm). Clinical team is notified.`,
            HI: `हार्ट रेट बहुत धीमी (${vitals.pulse} bpm) है। क्लिनिकल टीम को सूचित किया गया है।`,
            GU: `ધબકારા ઘણા ધીમા (${vitals.pulse} bpm) છે. સ્ટાફને જાણ કરવામાં આવી છે.`,
          },
        });
      }
    }

    // 4. Body Temperature (Hyperpyrexia)
    if (vitals.temperature !== undefined && vitals.temperature !== null && vitals.temperature > 0) {
      if (vitals.temperature >= 103.5) {
        alerts.push({
          type: 'HYPERPYREXIA_ALERT',
          severity: 'HIGH',
          symptoms: `Severe high grade fever (Temp: ${vitals.temperature}°F)`,
          description: `High-grade pyrexia (>= 103.5°F). Immediate antipyresis and septic screening indicated.`,
          patientNotice: {
            EN: `High fever recorded (${vitals.temperature}°F). Triage is preparing antipyretic evaluation.`,
            HI: `तेज बुखार (${vitals.temperature}°F) दर्ज हुआ है। तुरंत बुखार कम करने की दवा दी जाएगी।`,
            GU: `વધુ તાવ (${vitals.temperature}°F) નોંધાયો છે. યોગ્ય દવા આપવાની વ્યવસ્થા કરાશે.`,
          },
        });
      }
    }

    return alerts;
  }
}
