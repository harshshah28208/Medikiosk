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
      /\b(chest pain|chest tightness|pressure in chest|crushing chest|angina)\b|सीने में दर्द|छाती में दर्द|છાતીમાં દુખાવો|છાતીમાં દબાણ|છાતીમાં.*દુખાવો/i.test(textToEvaluate);

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
}
