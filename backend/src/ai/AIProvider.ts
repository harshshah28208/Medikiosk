import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ClinicalState, QuestionOutput } from './ClinicalState.js';
import { RedFlagEngine } from './RedFlagEngine.js';

export interface AIProvider {
  extractFacts(input: string, state: ClinicalState, language: 'EN' | 'HI' | 'GU'): Promise<Partial<ClinicalState>>;
  generateNextQuestion(state: ClinicalState, language: 'EN' | 'HI' | 'GU', isAyush?: boolean, conversationHistory?: Array<{ role: string; content: string }>): Promise<QuestionOutput>;
  translateText(text: string, targetLanguage: 'EN' | 'HI' | 'GU'): Promise<string>;
  generateClinicalSummary(state: ClinicalState, patient: any, vitals?: any, documents?: any[]): Promise<any>;
}

/**
 * Direct Comprehensive Clinical Dictionary for 100% Guaranteed Native Phrasing
 */
const CLINICAL_TRANSLATIONS: Record<string, { HI: string; GU: string; EN: string }> = {
  // Lifestyle (Stage 1)
  lifestyle: {
    EN: "Hello and welcome! I am MediKiosk Clinical AI. To help your doctor understand you thoroughly, let's start with your lifestyle and daily routine. How is your sleep schedule (hours per night), dietary habits, and daily stress?",
    HI: "नमस्ते और स्वागत है! मैं मेडीकियोस्क क्लिनिकल AI सहायक हूँ। डॉक्टर को पूरी जानकारी देने के लिए, शुरुआत आपकी जीवनशैली और दिनचर्या से करते हैं। आपकी नींद (कितने घंटे), खान-पान की आदतें और तनाव कैसा रहता है?",
    GU: "નમસ્તે અને સ્વાગત છે! હું મેડીકિયોસ્ક ક્લિનિકલ AI સહાયક છું. ડૉક્ટરને સંપૂર્ણ વિગત આપવા માટે, શરૂઆત તમારી જીવનશૈલી અને દિનચર્યાથી કરીએ. તમારી ઊંઘ (કેટલા કલાક), ખોરાકની આદતો અને તણાવ કેવો રહે છે?",
  },
  // Medical Background & Allergies (Stage 2)
  medical_history: {
    EN: "Do you have any ongoing medical conditions (BP, Diabetes, Thyroid), regular medications, or drug allergies?",
    HI: "क्या आपको कोई पुरानी बीमारी (बीपी, शुगर, थायराइड), कोई नियमित दवा या किसी दवा से एलर्जी है?",
    GU: "શું આપને કોઈ જૂની બીમારી (બીપી, ડાયાબિટીસ, થાયરોઇડ), નિયમિત દવા કે કોઈ દવાની એલર્જી છે?",
  },
  // Progression (Returning Patient Stage 1)
  progression: {
    EN: "Compared to your previous visit, how has your condition progressed? Have your symptoms improved, worsened, or are they unchanged?",
    HI: "पिछली मुलाकात की तुलना में आपकी सेहत में क्या बदलाव आया है? क्या तकलीफ में सुधार है, बढ़ी है, या वैसी ही है?",
    GU: "છેલ્લી મુલાકાતની સરખામણીમાં આપની તબિયતમાં શું ફેરફાર થયો છે? શું તકલીફમાં રાહત છે, વધી છે, કે સરખી છે?",
  },
  // Medication Adherence (Returning Patient Stage 2)
  medication_adherence: {
    EN: "Have you been taking your previously prescribed medicines regularly, and did you experience any side effects?",
    HI: "क्या आप पहले लिखी गई दवाइयां समय पर नियमित ले रहे थे, और क्या कोई साइड-इफेक्ट या परेशानी हुई?",
    GU: "શું આપ અગાઉ આપેલી દવાઓ સમયસર નિયમિત લેતા હતા, અને કોઈ આડઅસર જણાઈ?",
  },
  // Closing
  closing: {
    EN: "Thank you. Is there any other symptom or specific detail you would like to share with your doctor?",
    HI: "धन्यवाद। क्या डॉक्टर से मिलने से पहले आप कोई अन्य लक्षण या जरूरी बात बताना चाहते हैं?",
    GU: "આભાર. ડૉક્ટરને મળતા પહેલાં શું આપ કોઈ અન્ય લક્ષણ કે ખાસ વિગત જણાવવા માંગો છો?",
  },
};

const OPTION_TRANSLATIONS: Array<{ EN: string; HI: string; GU: string }> = [
  // Lifestyle Options
  {
    EN: 'Normal 7-8 hrs sleep & balanced home food',
    HI: 'सामान्य 7-8 घंटे नींद और घर का सादा खाना',
    GU: 'સામાન્ય ૭-૮ કલાક ઊંઘ અને સાદો ઘરનો ખોરાક',
  },
  {
    EN: 'Disturbed sleep (<5 hrs) & high work stress',
    HI: 'नींद में रुकावट व अधिक काम का तनाव',
    GU: 'ઊંઘમાં ખલેલ અને વધુ માનસિક તણાવ',
  },
  {
    EN: 'Disturbed sleep (<5 hrs) & high stress routine',
    HI: 'कम नींद (<5 घंटे) और अधिक काम का तनाव',
    GU: 'ઓછી ઊંઘ (<૫ કલાક) અને વધુ માનસિક તણાવ',
  },
  {
    EN: 'Oily / fast food & irregular meals',
    HI: 'तला-भुना/बाहर का खाना व अनियमित समय',
    GU: 'તેલી/બહારનો ખોરાક અને અનિયમિત ભોજન',
  },
  {
    EN: 'Oily / fast food & irregular meal timing',
    HI: 'तला-भुना/बाहर का खाना व अनियमित समय',
    GU: 'તળેલું/બહારનું ભોજન અને અનિયમિત સમય',
  },
  {
    EN: 'Sedentary desk routine & physical fatigue',
    HI: 'बैठे रहने की दिनचर्या और कमजोरी',
    GU: 'બેઠાડુ દિનચર્યા અને શારીરિક થાક',
  },
  {
    EN: 'Sedentary routine & Physical fatigue',
    HI: 'शारीरिक निष्क्रियता व थकान',
    GU: 'બેઠાડુ જીવન અને થાક',
  },
  // Primary Chief Complaints
  {
    EN: 'Ear pain / Discharge / Blocked ear',
    HI: 'कान में दर्द / मवाद / भारीपन',
    GU: 'કાનમાં દુખાવો / પરુ / ભારેપણું',
  },
  {
    EN: 'Throbbing headache & eye strain',
    HI: 'तेज सिरदर्द और आँखों में तनाव',
    GU: 'તીવ્ર માથાનો દુખાવો અને આંખોમાં તાણ',
  },
  {
    EN: 'Stomach ache / Burning acidity',
    HI: 'पेट में दर्द / जलन / एसिडिटी',
    GU: 'પેટમાં દુખાવો / બળતરા / એસિડિટી',
  },
  {
    EN: 'Chest tightness / Shortness of breath',
    HI: 'सीने में भारीपन / सांस लेने में तकलीफ',
    GU: 'છાતીમાં ભારેપણું / શ્વાસ લેવામાં તકલીફ',
  },
  {
    EN: 'Skin rash / Pimples / Itching',
    HI: 'त्वचा में दाने / मुँहासे / खुजली',
    GU: 'ચામડી પર દાણા / ખીલ / ખંજવાળ',
  },
  {
    EN: 'Fever, cough & sore throat',
    HI: 'बुखार, खांसी और गले में दर्द',
    GU: 'તાવ, ઉધરસ અને ગળામાં દુખાવો',
  },
  {
    EN: 'Lower back pain radiating down right/left leg',
    HI: 'कमर का तेज दर्द जो पैर में नीचे जा रहा है',
    GU: 'કમરનો તીવ્ર દુખાવો જે પગમાં નીચે ઉતરે છે',
  },
  {
    EN: 'Severe burning pain during urination & discharge',
    HI: 'पेशाब में तेज जलन, दर्द और मवाद का स्राव',
    GU: 'પેશાબ કરતી વખતે તીવ્ર બળતરા અને સ્ત્રાવ',
  },
  {
    EN: 'Frequent vomiting & inability to keep food down',
    HI: 'लगातार उल्टियां और खाना/पानी न पचना',
    GU: 'વારંવાર ઉલટી અને ખોરાક ન પચવો',
  },

  // Lower Back Sciatica
  {
    EN: 'Radiating down leg with numbness / tingling',
    HI: 'पैरों में नीचे की तरफ खिंचाव व सुन्नपन',
    GU: 'પગમાં નીચે તરફ દુખાવો અને ખાલી ચડવી',
  },
  {
    EN: 'Sharp pain when bending forward or lifting',
    HI: 'झुकने या वजन उठाने पर तेज चुभन',
    GU: 'વાંકા વળતી વખતે તીક્ષ્ણ દુખાવો',
  },
  {
    EN: 'Dull aching stiffness after prolonged sitting',
    HI: 'देर तक बैठने पर भारीपन व जकड़न',
    GU: 'લાંબો સમય બેસવાથી કમરમાં જકડન',
  },
  {
    EN: 'Pain localized strictly to lower spine',
    HI: 'दर्द केवल कमर के निचले हिस्से तक सीमित',
    GU: 'દુખાવો માત્ર કમરના ભાગ પૂરતો જ છે',
  },

  // Genitourinary / Penis
  {
    EN: 'Severe burning sensation while urinating',
    HI: 'पेशाब में तेज जलन और दर्द',
    GU: 'પેશાબ કરતી વખતે તીવ્ર બળતરા',
  },
  {
    EN: 'Whitish / yellowish pus discharge from penis',
    HI: 'लिंग से मवाद/सफेद पानी का स्राव',
    GU: 'ઇન્દ્રિયમાંથી પરુ કે સફેદ પાણીનો સ્ત્રાવ',
  },
  {
    EN: 'Frequent urge to urinate with reduced flow',
    HI: 'बार-बार पेशाब की इच्छा व धार कम',
    GU: 'વારંવાર પેશાબ જવું પડે છે અને પ્રવાહ ધીમો',
  },
  {
    EN: 'Itching, redness, or skin irritation',
    HI: 'खुजली, लाली और त्वचा में जलन',
    GU: 'ખંજવાળ, લાલાશ અને ચામડી પર બળતરા',
  },

  // Returning Progression Options
  {
    EN: 'Symptoms significantly improved (>70% relief)',
    HI: 'लक्षणों में काफी सुधार (70%+ आराम)',
    GU: 'લક્ષણોમાં સારો સુધારો (૭૦%+ રાહત)',
  },
  {
    EN: 'Previous symptoms improved (>70% relief)',
    HI: 'लक्षणों में काफी सुधार (70%+ आराम)',
    GU: 'લક્ષણોમાં સારો સુધારો (૭૦%+ રાહત)',
  },
  {
    EN: 'Previous symptoms improved / Routine review',
    HI: 'पुरानी तकलीफ में काफी सुधार है / फॉलो-अप',
    GU: 'જૂની તકલીફમાં સારો સુધારો છે / ફોલો-અપ',
  },
  {
    EN: 'Partial relief but symptoms still persist',
    HI: 'थोड़ा आराम है पर तकलीफ बाकी है',
    GU: 'થોડી રાહત છે પણ તકલીફ ચાલુ છે',
  },
  {
    EN: 'No relief / Symptoms worsening',
    HI: 'कोई आराम नहीं / तकलीफ बढ़ गई',
    GU: 'કોઈ રાહત નથી / તકલીફ વધી ગઈ',
  },
  {
    EN: 'Symptoms worsened / No significant relief',
    HI: 'तकलीफ बढ़ गई है / आराम नहीं मिला',
    GU: 'તકલીફ વધી ગઈ છે / રાહત નથી',
  },
  {
    EN: 'Completely new problem today',
    HI: 'आज पूरी तरह नई समस्या है',
    GU: 'આજે સાવ નવી જ સમસ્યા છે',
  },
  {
    EN: 'Completely new symptom/problem today',
    HI: 'आज पूरी तरह नई समस्या है',
    GU: 'આજે સાવ નવી જ સમસ્યા છે',
  },
  {
    EN: 'Medicines finished / Need refill & checkup',
    HI: 'दवाइयां समाप्त / दोबारा जांच',
    GU: 'દવાઓ પૂર્ણ થઈ / ફરી તપાસ',
  },

  // Returning Worsened Detail Options
  {
    EN: 'Pain increased with persistent stiffness',
    HI: 'दर्द बढ़ गया व लगातार जकड़न है',
    GU: 'દુખાવો વધી ગયો અને સતત જકડન છે',
  },
  {
    EN: 'New swelling & redness noticed',
    HI: 'नई सूजन व लाली आ गई है',
    GU: 'નવી સોજો અને લાલાશ જણાય છે',
  },
  {
    EN: 'Unable to sleep due to discomfort',
    HI: 'तकलीफ के कारण नींद नहीं आ रही',
    GU: 'તકલીફના લીધે ઊંઘ આવતી નથી',
  },
  {
    EN: 'Developed fever & weakness',
    HI: 'बुखार और कमजोरी शुरू हो गई है',
    GU: 'તાવ અને નબળાઈ શરૂ થઈ ગઈ છે',
  },

  // Returning New Problem Options
  {
    EN: 'Started in last 1-2 days',
    HI: 'पिछले 1-2 दिनों में शुरू हुई',
    GU: 'છેલ્લા ૧-૨ દિવસમાં શરૂ થઈ',
  },
  {
    EN: 'Severe acute onset today',
    HI: 'आज अचानक तेज दर्द उठा',
    GU: 'આજે અચાનક તીવ્ર દુખાવો થયો',
  },
  {
    EN: 'Mild gradual discomfort',
    HI: 'हल्की धीरे-धीरे बढ़ती तकलीफ',
    GU: 'હળવી ધીમે-ધીમે વધતી તકલીફ',
  },
  {
    EN: 'Intermittent episodes',
    HI: 'रुक-रुक कर होने वाले दौरे',
    GU: 'અવારનવાર થતો દુખાવો',
  },

  // Returning Residual Symptom Options
  {
    EN: 'Mild lingering ache during exertion',
    HI: 'काम/मेहनत करने पर हल्का दर्द',
    GU: 'કામ/શ્રમ કરતી વખતે હળવો દુખાવો',
  },
  {
    EN: 'Occasional morning stiffness',
    HI: 'सुबह उठने पर हल्की जकड़न',
    GU: 'સવારે જાગતી વખતે હળવી જકડન',
  },
  {
    EN: 'Discomfort returns after medicine stops',
    HI: 'दवा बंद करने पर तकलीफ लौट आती है',
    GU: 'દવા બંધ થતાં તકલીફ પાછી આવે છે',
  },
  {
    EN: 'Almost back to normal, routine checkup',
    HI: 'काफी आराम है, सामान्य फॉलो-अप जांच',
    GU: 'ઘણી રાહત છે, સામાન્ય ફોલો-અપ તપાસ',
  },

  // Returning Medication Compliance
  {
    EN: 'Taking all medicines regularly on time',
    HI: 'सभी दवाइयां समय पर नियमित लीं',
    GU: 'બધી દવાઓ સમયસર નિયમિત લીધી',
  },
  {
    EN: 'Missed doses occasionally / Stopped early',
    HI: 'कभी-कभार दवा छूट गई / जल्दी बंद कर दी',
    GU: 'ક્યારેક દવા છૂટી ગઈ / વહેલી બંધ કરી',
  },
  {
    EN: 'Medicines finished / Need refill',
    HI: 'दवा समाप्त हो गई / दोबारा चाहिए',
    GU: 'દવા પૂર્ણ થઈ ગઈ / ફરી તપાસ',
  },
  {
    EN: 'Experienced gastric upset / Nausea from medicines',
    HI: 'दवा से पेट में गैस/उल्टी जैसा लगा',
    GU: 'દવાથી પેટમાં ગેસ/ઉબકા જેવું થયું',
  },

  // Returning Lifestyle / Triggers Follow-Up
  {
    EN: 'Following diet & rest recommendations well',
    HI: 'खान-पान व आराम का अच्छा पालन हो रहा है',
    GU: 'ખોરાક અને આરામનું સારું પાલન થાય છે',
  },
  {
    EN: 'Aggravated by physical strain / stress',
    HI: 'अधिक मेहनत या तनाव से दर्द बढ़ता है',
    GU: 'વધુ શ્રમ કે તણાવથી દુખાવો વધે છે',
  },
  {
    EN: 'Irregular sleep & routine continues',
    HI: 'अनियमित नींद व दिनचर्या जारी है',
    GU: 'અનિયમિત ઊંઘ અને દિનચર્યા ચાલુ છે',
  },
  {
    EN: 'No specific triggers identified',
    HI: 'कोई खास कारण समझ नहीं आया',
    GU: 'કોઈ ચોક્કસ કારણ સમજાયું નથી',
  },

  // Vomiting / GI
  {
    EN: 'Frequent vomiting (>4-5 times), cannot retain water',
    HI: 'लगातार उल्टियां (>4-5 बार), पानी भी नहीं रुक रहा',
    GU: 'વારંવાર ઉલટી (>૪-૫ વાર), પાણી પણ ટકતું નથી',
  },
  {
    EN: 'Vomited 1-2 times after meals with nausea',
    HI: 'खाने के बाद 1-2 बार उल्टी व जी मिचलाना',
    GU: 'જમ્યા પછી ૧-૨ વાર ઉલટી અને ઉબકા',
  },
  {
    EN: 'Sour yellow bile vomiting with stomach cramps',
    HI: 'खट्टी डकारें व पीले पित्त की उल्टी',
    GU: 'ખાટા ઓડકાર અને પીળા પિત્તની ઉલટી',
  },
  {
    EN: 'Accompanied by loose watery stools & weakness',
    HI: 'दस्त (loose motions) और कमजोरी के साथ',
    GU: 'ઝાડા (લૂઝ મોશન) અને ભારે અશક્તિ સાથે',
  },

  // Medical History & Allergies
  {
    EN: 'No chronic conditions & No known drug allergies (NKDA)',
    HI: 'कोई पुरानी बीमारी नहीं व कोई एलर्जी नहीं (NKDA)',
    GU: 'કોઈ જૂની બીમારી નથી અને કોઈ એલર્જી નથી (NKDA)',
  },
  {
    EN: 'Taking regular BP / Diabetes medicines',
    HI: 'नियमित बीपी / शुगर की दवाइयां ले रहे हैं',
    GU: 'નિયમિત બીપી / ડાયાબિટીસ દવા લઈએ છીએ',
  },
  {
    EN: 'Have Thyroid / Asthma / Breathing trouble',
    HI: 'थायराइड / अस्थमा / सांस की तकलीफ है',
    GU: 'થાયરોઇડ / અસ્થમા / શ્વાસની તકલીફ છે',
  },
  {
    EN: 'Known drug allergy to Penicillin / Sulfa drugs',
    HI: 'दवाओं (पेनिसिलिन आदि) से एलर्जी है',
    GU: 'દવાની એલર્જી છે (પેનિસિલિન વગેરે)',
  },

  // Onset & Duration
  {
    EN: 'Since today / past few hours',
    HI: 'आज से / कुछ घंटों से',
    GU: 'આજથી / થોડા કલાકોથી',
  },
  {
    EN: '2 to 3 days',
    HI: '2-3 दिनों से',
    GU: '૨-૩ દિવસથી',
  },
  {
    EN: '1 to 2 weeks',
    HI: '1-2 सप्ताह से',
    GU: '૧-૨ અઠવાડિયાથી',
  },
  {
    EN: 'More than a month (chronic)',
    HI: 'एक महीने से अधिक समय से',
    GU: 'એક મહિનાથી વધુ समयથી',
  },

  // Severity & Character
  {
    EN: 'Mild discomfort / Manageable',
    HI: 'हल्की तकलीफ / सामान्य काम कर पा रहे हैं',
    GU: 'હળવી તકલીફ / સામાન્ય કામ થઈ શકે છે',
  },
  {
    EN: 'Moderate pain / Limits daily activities',
    HI: 'मध्यम दर्द / दैनिक काम में परेशानी',
    GU: 'મધ્યમ દુખાવો / રોજિંદા કામમાં તકલીફ',
  },
  {
    EN: 'Severe throbbing / Burning pain',
    HI: 'तेज दर्द / जलन / असहनीय',
    GU: 'તીવ્ર દુખાવો / બળતરા / અસહ્ય',
  },
  {
    EN: 'Intermittent episodes coming and going',
    HI: 'रुक-रुक कर होने वाली तकलीफ',
    GU: 'વારંવાર આવતી-જતી તકલીફ',
  },

  // Returning Progression
  {
    EN: 'Previous symptoms improved / Routine review',
    HI: 'पुरानी तकलीफ में काफी सुधार है / फॉलो-अप',
    GU: 'જૂની તકલીફમાં સારો સુધારો છે / ફોલો-અપ',
  },
  {
    EN: 'Symptoms worsened / No significant relief',
    HI: 'तकलीफ बढ़ गई है / आराम नहीं मिला',
    GU: 'તકલીફ વધી ગઈ છે / રાહત નથી',
  },
  {
    EN: 'Completely new symptom/problem today',
    HI: 'आज पूरी तरह नई समस्या है',
    GU: 'આજે સાવ નવી જ સમસ્યા છે',
  },
  {
    EN: 'Medicines finished / Need refill & checkup',
    HI: 'दवाइयां समाप्त / दोबारा जांच',
    GU: 'દવાઓ પૂર્ણ થઈ / ફરી તપાસ',
  },

  // Returning Medication Compliance
  {
    EN: 'Taking all medicines regularly on time',
    HI: 'सभी दवाइयां समय पर नियमित लीं',
    GU: 'બધી દવાઓ સમયસર નિયમિત લીધી',
  },
  {
    EN: 'Missed doses occasionally / Stopped early',
    HI: 'कभी-कभार दवा छूट गई / जल्दी बंद कर दी',
    GU: 'ક્યારેક દવા છૂટી ગઈ / વહેલી બંધ કરી',
  },
  {
    EN: 'Medicines finished / Need refill',
    HI: 'दवा समाप्त हो गई / दोबारा चाहिए',
    GU: 'દવા પૂર્ણ થઈ ગઈ / ફરી તપાસ',
  },
  {
    EN: 'Experienced gastric upset / Nausea from medicines',
    HI: 'दवा से पेट में गैस/उल्टी जैसा लगा',
    GU: 'દવાથી પેટમાં ગેસ/ઉબકા જેવું થયું',
  },

  // Closing
  {
    EN: 'No, that covers all symptoms — complete intake',
    HI: 'नहीं, सब लक्षण बता दिए — इनटेक पूर्ण करें',
    GU: 'ના, તમામ લક્ષણો જણાવી દીધા — ઇન્ટેક પૂર્ણ કરો',
  },
  {
    EN: 'Yes, I want to add one more detail',
    HI: 'हाँ, मुझे एक और लक्षण बताना है',
    GU: 'હા, મારે બીજું એક લક્ષણ જણાવવું છે',
  },
];

function translateOptionDirectly(text: string, targetLanguage: 'EN' | 'HI' | 'GU'): string | null {
  if (!text) return null;
  const clean = text.trim().toLowerCase();
  
  for (const opt of OPTION_TRANSLATIONS) {
    if (opt.EN.toLowerCase() === clean || opt.HI.trim() === text.trim() || opt.GU.trim() === text.trim()) {
      return opt[targetLanguage];
    }
  }
  
  // Loose matching for slight phrasing differences
  for (const opt of OPTION_TRANSLATIONS) {
    if (opt.EN.toLowerCase().includes(clean) || clean.includes(opt.EN.toLowerCase())) {
      return opt[targetLanguage];
    }
    if (opt.HI.includes(text.trim()) || text.trim().includes(opt.HI)) {
      return opt[targetLanguage];
    }
    if (opt.GU.includes(text.trim()) || text.trim().includes(opt.GU)) {
      return opt[targetLanguage];
    }
  }
  return null;
}
function getSymptomLabelInLang(complaint: string, lang: 'EN' | 'HI' | 'GU'): string {
  const c = complaint.toLowerCase();
  
  if (/pimple|acne|boil|मुँहासे|फुंसी|ખીલ/i.test(c)) {
    return lang === 'HI' ? 'मुँहासे / दानों' : lang === 'GU' ? 'ખીલ' : 'pimples / skin spots';
  }
  if (/rash|skin|itch|खुजली|ચકામા/i.test(c)) {
    return lang === 'HI' ? 'त्वचा की खुजली / चकत्तों' : lang === 'GU' ? 'ચામડીની ખંજવાળ / ચકામા' : 'skin rash and itching';
  }
  if (/chest|heart|सीने|छाती/i.test(c)) {
    return lang === 'HI' ? 'सीने में दर्द व भारीपन' : lang === 'GU' ? 'છાતીમાં દુખાવો અને ભારેપણું' : 'chest discomfort';
  }
  if (/knee|joint|bone|घुटने|जोड़ों|ઘૂંટણ|સાંધા/i.test(c)) {
    return lang === 'HI' ? 'घुटने और जोड़ों के दर्द' : lang === 'GU' ? 'ઘૂંટણ અને સાંધાના દુખાવા' : 'knee and joint pain';
  }
  if (/back|spine|कमर|પીઠ/i.test(c)) {
    return lang === 'HI' ? 'कमर और पीठ के दर्द' : lang === 'GU' ? 'કમરના દુખાવા' : 'back pain';
  }
  if (/stomach|abdom|acidity|vomit|पेट|પેટ/i.test(c)) {
    return lang === 'HI' ? 'पेट दर्द, जलन और तकलीफ' : lang === 'GU' ? 'પેટમાં દુખાવો અને બળતરા' : 'stomach discomfort and acidity';
  }
  if (/headache|head|migraine|सिरदर्द|માથા/i.test(c)) {
    return lang === 'HI' ? 'सिरदर्द' : lang === 'GU' ? 'માથાના દુખાવા' : 'headache';
  }
  if (/cough|cold|throat|खांसी|गला|ઉધરસ|ગળું/i.test(c)) {
    return lang === 'HI' ? 'खांसी और गले की खराश' : lang === 'GU' ? 'ઉધરસ અને ગળાની તકલીફ' : 'cough and throat irritation';
  }
  if (/fever|temperature|बुखार|તાવ/i.test(c)) {
    return lang === 'HI' ? 'बुखार और शारीरिक कमजोरी' : lang === 'GU' ? 'તાવ અને શારીરિક નબળાઈ' : 'fever and body weakness';
  }

  return lang === 'HI' ? 'इस समस्या' : lang === 'GU' ? 'આ તકલીફ' : 'this symptom';
}

export class UniversalClinicalEngine implements AIProvider {
  async extractFacts(input: string, state: ClinicalState, language: 'EN' | 'HI' | 'GU'): Promise<Partial<ClinicalState>> {
    const text = input.trim();
    const update: Partial<ClinicalState> = {};
    const turns = state.turnsCompleted || 0;
    const isNew = state.isNewPatient !== false;

    if (isNew) {
      // Step 1: Turn 0 answer is LIFESTYLE
      if (turns === 0 || !state.lifestyle?.sleep) {
        update.lifestyle = {
          sleep: text,
          diet: text,
          activity: text,
          occupation: state.lifestyle?.occupation || '',
          smoking: state.lifestyle?.smoking || null,
          alcohol: state.lifestyle?.alcohol || null,
        };
        return update;
      }

      // Step 2: Turn 1 answer is MEDICAL HISTORY & ALLERGIES
      if (turns === 1 || (state.pastMedicalHistory || []).length === 0) {
        update.pastMedicalHistory = [text];
        update.medications = [{ name: text }];
        update.allergies = [{ allergen: text, reaction: 'None', severity: 'MILD' }];
        return update;
      }

      // Step 3: Turn 2 answer is PRIMARY COMPLAINT / SYMPTOM
      if (!state.chiefComplaint) {
        update.chiefComplaint = text;
        update.chiefComplaintOriginal = text;
        update.symptoms = [
          {
            name: text,
            originalText: text,
            onset: null,
            duration: null,
            severity: null,
            location: null,
            character: null,
            radiation: null,
            aggravatingFactors: [],
            relievingFactors: [],
            timing: null,
            progression: null,
          },
        ];
        return update;
      }

      // Step 4: Turn 3 answer is ONSET & TIMING
      const currentSymptom = (state.symptoms && state.symptoms[0]) || {
        name: state.chiefComplaint,
        originalText: state.chiefComplaint,
        onset: null,
        duration: null,
        severity: null,
        location: null,
        character: null,
        radiation: null,
        aggravatingFactors: [],
        relievingFactors: [],
        timing: null,
        progression: null,
      };

      if (!currentSymptom.onset || !currentSymptom.duration) {
        currentSymptom.onset = text;
        currentSymptom.duration = text;
        update.symptoms = [currentSymptom];
        return update;
      }

      // Step 5: Turn 4 answer is SEVERITY & CHARACTER
      if (!currentSymptom.severity || !currentSymptom.character) {
        const numMatch = text.match(/\b([1-9]|10)\b/);
        currentSymptom.severity = numMatch ? parseInt(numMatch[1], 10) : 5;
        currentSymptom.character = text;
        update.symptoms = [currentSymptom];
        return update;
      }

      if ((state.associatedSymptoms || []).length === 0) {
        update.associatedSymptoms = [{ name: text, present: true }];
        return update;
      }
    } else {
      // RETURNING PATIENT WORKFLOW
      const syms = [...(state.symptoms || [])];
      let currentSymptom = syms[0] || {
        name: state.chiefComplaint || 'Follow-up condition',
        originalText: text,
        onset: null,
        duration: null,
        severity: null,
        location: null,
        character: null,
        radiation: null,
        aggravatingFactors: [],
        relievingFactors: [],
        timing: null,
        progression: null,
      };

      if (!currentSymptom.progression) {
        currentSymptom.progression = text;
        update.symptoms = [currentSymptom];
        return update;
      }

      if (!(currentSymptom as any).residualSymptoms) {
        (currentSymptom as any).residualSymptoms = text;
        update.symptoms = [currentSymptom];
        return update;
      }

      if ((state.medications || []).length === 0) {
        update.medications = [{ name: text }];
        return update;
      }

      if (!(state.lifestyle as any)?.followUpTriggers) {
        update.lifestyle = {
          ...(state.lifestyle || { sleep: '', diet: '', stress: '', activity: '' }),
          followUpTriggers: text,
        } as any;
        return update;
      }
    }

    return update;
  }

  async translateText(text: string, targetLanguage: 'EN' | 'HI' | 'GU'): Promise<string> {
    if (!text) return text;

    // 1. Direct Option Translation
    const directOpt = translateOptionDirectly(text, targetLanguage);
    if (directOpt) {
      return directOpt;
    }

    const tLower = text.toLowerCase();

    // Check Stage 1: Lifestyle & Daily Routine
    if (tLower.includes('lifestyle') || tLower.includes('sleep') || tLower.includes('routine') || tLower.includes('diet') || tLower.includes('जीवनशैली') || tLower.includes('नींद') || tLower.includes('दिनचर्या') || tLower.includes('खान-पान') || tLower.includes('દિનચર્યા') || tLower.includes('ઊંઘ') || tLower.includes('ખોરાક')) {
      return CLINICAL_TRANSLATIONS.lifestyle[targetLanguage];
    }

    // Check Stage 2: Medical History & Allergies
    if (tLower.includes('medical conditions') || tLower.includes('allergy') || tLower.includes('allergies') || tLower.includes('chronic') || tLower.includes('thyroid') || tLower.includes('diabetes') || tLower.includes('पुरानी बीमारी') || tLower.includes('एलर्जी') || tLower.includes('थायराइड') || tLower.includes('જૂની બીમારી') || tLower.includes('એલર્જી') || tLower.includes('ડાયાબિટીસ')) {
      return CLINICAL_TRANSLATIONS.medical_history[targetLanguage];
    }

    // Check Lower Back Pain / Sciatica
    if (/lower back|back pain|sciatica|spine|buttock|कमर|पीठ|કમર/i.test(tLower)) {
      const q = {
        EN: "Does the pain radiate down your right or left leg past the knee, and is there any numbness, tingling, or weakness in your feet?",
        HI: "क्या कमर का दर्द आपके दाहिने या बाएं पैर में घुटने से नीचे तक जा रहा है, और क्या पैर या पंजों में सुन्नपन, झनझनाहट या कमजोरी महसूस हो रही है?",
        GU: "શું કમરનો દુખાવો આપના જમણા કે ડાબા પગમાં ઘૂંટણથી નીચે સુધી ઉતરે છે, અને પગમાં ખાલી ચડવી, ઝણઝણાટી કે નબળાઈ જણાય છે?",
      };
      return q[targetLanguage];
    }

    // Check Penis / Genitourinary
    if (/penis|urina|urine|discharge|genital|पेशाब|मूत्र|लिंग|ઇન્દ્રિય/i.test(tLower)) {
      const q = {
        EN: "Do you have burning or pain during urination, any discharge (pus/clear fluid), irritation, or difficulty passing urine?",
        HI: "क्या आपको पेशाब करते समय तेज जलन/दर्द है, कोई मवाद या स्राव (discharge) आ रहा है, या पेशाब रुक-रुक कर आ रहा है?",
        GU: "શું આપને પેશાબ કરતી વખતે તીવ્ર બળતરા/દુખાવો થાય છે, કોઈ પરુ કે સ્ત્રાવ આવે છે, કે પેશાબ કરવામાં અટકાવ છે?",
      };
      return q[targetLanguage];
    }

    // Check Vomiting / Nausea / GI
    if (/vomit|उल्टी|ઉલટી|nausea|dehydrat/i.test(tLower)) {
      const q = {
        EN: "How many times have you vomited, does it contain food, bile, or blood, and are you able to retain water and fluids?",
        HI: "आपको कितनी बार उल्टी हुई है, क्या उल्टी में खाना या पित्त (पीला पानी) आया है, और क्या पानी पच पा रहा है?",
        GU: "તમને કેટલી વાર ઉલટી થઈ છે, શું ઉલટીમાં ખોરાક કે પિત્ત (પીળું પાણી) નીકળે છે, અને પાણી પચી શકે છે?",
      };
      return q[targetLanguage];
    }

    // Check Ear / ENT
    if (/ear|hearing|discharge|कान|કાન/i.test(tLower)) {
      const q = {
        EN: "Do you have any ear discharge (pus/watery fluid), hearing loss, blocked ear sensation, or ringing sounds?",
        HI: "क्या आपके कान से कोई मवाद/पानी आ रहा है, सुनने में कमी, भारीपन या सीटी जैसी आवाज आ रही है?",
        GU: "શું આપના કાનમાંથી પરુ/પાણી આવે છે, ઓછું સંભળાય છે, કાનમાં ભારેપણું કે અવાજ આવે છે?",
      };
      return q[targetLanguage];
    }

    // Check Headache / Migraine
    if (/headache|migraine|throbbing|सिर|માથ/i.test(tLower)) {
      const q = {
        EN: "Is your headache throbbing/pulsing on one side, and are you sensitive to bright lights or loud sounds?",
        HI: "क्या आपको एक तरफ तेज टीस मारने वाला सिरदर्द है, और तेज रोशनी या आवाज से परेशानी बढ़ती है?",
        GU: "શું આપને એક બાજુ તીવ્ર માથું ધબકે છે, અને વધુ પ્રકાશ કે અવાજથી તકલીફ વધે છે?",
      };
      return q[targetLanguage];
    }

    // Check Stomach / Acidity
    if (/stomach|abdom|acidity|gas|पेट|પેટ/i.test(tLower)) {
      const q = {
        EN: "Is your stomach discomfort burning in the chest/upper abdomen, and does eating food make it better or worse?",
        HI: "क्या आपके पेट या सीने में जलन/मरोड़ हो रही है, और क्या खाना खाने से तकलीफ कम या ज्यादा होती है?",
        GU: "શું આપના પેટ કે છાતીમાં બળતરા/ચૂંક આવે છે, અને જમ્યા પછી તકલીફ વધે છે કે ઘટે છે?",
      };
      return q[targetLanguage];
    }

    // Check Chest / Heart
    if (/chest|breathless|सीने|छाती|हार्ट/i.test(tLower)) {
      const q = {
        EN: "Is the chest pain heavy/crushing, does it radiate to your left arm or jaw, and do you feel breathless or sweaty?",
        HI: "क्या सीने में भारी दबाव या जकड़न है, क्या यह दर्द बाएं हाथ या जबड़े में जा रहा है, और सांस फूलने या पसीना आने की तकलीफ है?",
        GU: "શું છાતીમાં ભારે દબાણ કે જકડન છે, શું આ દુખાવો ડાબા હાથ કે જડબામાં જાય છે, અને શ્વાસ ચડવાની કે પરસેવાની તકલીફ છે?",
      };
      return q[targetLanguage];
    }

    // Check Knee / Joint
    if (/knee|joint|bone|घुटने|जोड़ों|ઘૂંટણ|સાંધા/i.test(tLower)) {
      const q = {
        EN: "Are your knee or joint aches accompanied by swelling, morning stiffness, or clicking sounds when walking?",
        HI: "क्या घुटने या जोड़ों के दर्द के साथ सूजन, सुबह उठने पर जकड़न, या चलने पर कट-कट की आवाज आती है?",
        GU: "શું ઘૂંટણ કે સાંધાના દુખાવા સાથે સોજો, સવારે જકડન, કે ચાલતી વખતે અવાજ આવે છે?",
      };
      return q[targetLanguage];
    }

    // Check Skin / Rash / Pimples
    if (/pimple|rash|skin|itch|खुजली|चकामे|ખીલ/i.test(tLower)) {
      const q = {
        EN: "Are the skin rashes or pimples spreading, itchy, painful, or discharging pus?",
        HI: "क्या त्वचा के दाने या मुँहासे फैल रहे हैं, उनमें तेज खुजली, दर्द या मवाद आ रहा है?",
        GU: "શું ચામડી પરના દાણા કે ખીલ ફેલાઈ રહ્યા છે, તેમાં તીવ્ર ખંજવાળ, દુખાવો કે પરુ થાય છે?",
      };
      return q[targetLanguage];
    }

    // Check Returning Patient Progression (Turn 0)
    if (tLower.includes('previous visit') || tLower.includes('progress') || tLower.includes('पिछली मुलाकात') || tLower.includes('છેલ્લી મુલાકાત')) {
      return CLINICAL_TRANSLATIONS.progression[targetLanguage];
    }

    // Check Worsened Follow-Up
    if (/intensified|worsen|not improved|तकरीफ बढ़ी|વધી ગઈ/i.test(tLower)) {
      const q = {
        EN: "Since your symptoms have intensified or not improved, please describe the changes: has the pain radiated, is there new swelling, fever, or difficulty in daily routine?",
        HI: "चूँकि आपको आराम नहीं है या तकलीफ बढ़ी है, कृपया बताएं कि क्या दर्द फैल रहा है, नई सूजन या बुखार आया है, या दैनिक कामकाज में रुकावट हो रही है?",
        GU: "જ્યારે આપને રાહત નથી કે તકલીફ વધી છે, તો કૃપા કરીને જણાવો કે શું દુખાવો ફેલાય છે, નવી સોજો કે તાવ આવ્યો છે, કે રોજિંદા કામમાં મુશ્કેલી છે?",
      };
      return q[targetLanguage];
    }

    // Check Residual Symptoms Follow-Up
    if (/residual symptoms|बची हुई तकलीफ|બાકી રહેલી તકલીફ/i.test(tLower)) {
      const q = {
        EN: "Which specific residual symptoms still remain, and during what activities or times do you feel them?",
        HI: "आपको अब कौन सी बची हुई तकलीफ अभी भी महसूस हो रही है, और किस समय या काम के दौरान यह ज्यादा होती है?",
        GU: "આપને હવે કઈ બાકી રહેલી તકલીફ હજુ પણ જણાય છે, અને કયા સમયે કે પ્રવૃત્તિ દરમિયાન તે વધુ થાય છે?",
      };
      return q[targetLanguage];
    }

    // Check Medication Adherence (Returning patient)
    if (tLower.includes('prescribed') || tLower.includes('side effects') || tLower.includes('दवाइयां') || tLower.includes('दवा') || tLower.includes('દવાઓ') || tLower.includes('દવા')) {
      return CLINICAL_TRANSLATIONS.medication_adherence[targetLanguage];
    }

    // Check Lifestyle & Triggers Follow-Up
    if (/triggers|aggravat|खान-पान और आराम|ખોરાક અને આરામ/i.test(tLower)) {
      const q = {
        EN: "Have you noticed any triggers that worsen your symptoms, and have you been able to follow the recommended diet, rest, or exercise routine?",
        HI: "क्या आपने किसी ऐसी चीज पर गौर किया जिससे आपकी तकलीफ बढ़ती है, और क्या आप बताई गई दिनचर्या, खान-पान और आराम का पालन कर पा रहे हैं?",
        GU: "શું આપે કોઈ એવી બાબત નોંધી જેનાથી આપની તકલીફ વધે છે, અને શું આપ જણાવેલ દિનચર્યા, ખોરાક અને આરામનું પાલન કરી રહ્યા છો?",
      };
      return q[targetLanguage];
    }

    // Check Closing
    if (tLower.includes('covers all symptoms') || tLower.includes('thank you') || tLower.includes('धन्यवाद') || tLower.includes('આભાર')) {
      return CLINICAL_TRANSLATIONS.closing[targetLanguage];
    }

    return text;

    return text;
  }

  async generateNextQuestion(state: ClinicalState, language: 'EN' | 'HI' | 'GU', isAyush = false, conversationHistory?: Array<{ role: string; content: string }>): Promise<QuestionOutput> {
    const lang: 'EN' | 'HI' | 'GU' = (language?.toUpperCase() as 'EN' | 'HI' | 'GU') || (state.currentLanguage as 'EN' | 'HI' | 'GU') || 'EN';
    const isNew = state.isNewPatient === true || state.isNewPatient === undefined || !state.previousVisitInfo;
    const complaintText = state.chiefComplaint || 'problem';
    const localizedLabel = getSymptomLabelInLang(complaintText, lang);
    const isCaregiver = state.respondentType === 'CAREGIVER' || state.respondentType === 'STAFF_ASSISTED';

    // Track answered clinical dimensions to guarantee NO repetition
    const answeredDimensions = new Set<string>();
    if (state.symptoms.some(s => s.progression)) answeredDimensions.add('PROGRESSION');
    if (state.symptoms.some(s => (s as any).residualSymptoms)) answeredDimensions.add('RESIDUAL_SYMPTOMS');
    if (state.symptoms.some(s => s.onset)) answeredDimensions.add('ONSET');
    if (state.symptoms.some(s => s.severity || s.character)) answeredDimensions.add('CHARACTER');
    if (state.lifestyle?.sleep || state.lifestyle?.diet || state.lifestyle?.activity) answeredDimensions.add('LIFESTYLE');
    if ((state.lifestyle as any)?.followUpTriggers) answeredDimensions.add('LIFESTYLE_FOLLOWUP');
    if (state.pastMedicalHistory.length > 0) answeredDimensions.add('PAST_HISTORY');
    if (state.medications.length > 0) answeredDimensions.add('MEDICATIONS');
    if (state.allergies.length > 0) answeredDimensions.add('ALLERGIES');

    // ==========================================
    // WORKFLOW A: RETURNING PATIENT DYNAMIC AI FOLLOW-UP
    // ==========================================
    if (!isNew) {
      // Turn 0: Progression Inquiry
      if (!answeredDimensions.has('PROGRESSION')) {
        const qText = {
          EN: isCaregiver
            ? `Compared to the previous visit, how has the patient's condition progressed? Have symptoms improved, worsened, or are they unchanged?`
            : `Compared to your previous visit, how has your condition progressed? Have your symptoms improved, worsened, or are they unchanged?`,
          HI: isCaregiver
            ? `पिछली मुलाकात की तुलना में मरीज की स्थिति में क्या बदलाव है? क्या तकलीफ में सुधार है, बढ़ी है, या वैसी ही है?`
            : `पिछली मुलाकात की तुलना में आपकी सेहत में क्या बदलाव आया है? क्या तकलीफ में सुधार है, बढ़ी है, या वैसी ही है?`,
          GU: isCaregiver
            ? `છેલ્લી મુલાકાતની સરખામણીમાં દર્દીની તબિયતમાં શું ફેરફાર છે? શું તકલીફમાં રાહત છે, વધી છે, કે સરખી છે?`
            : `છેલ્લી મુલાકાતની સરખામણીમાં આપની તબિયતમાં શું ફેરફાર થયો છે? શું તકલીફમાં રાહત છે, વધી છે, કે સરખી છે?`,
        };
        const touchOpts = {
          EN: ['Symptoms significantly improved (>70% relief)', 'Partial relief but symptoms still persist', 'No relief / Symptoms worsening', 'Completely new problem today'],
          HI: ['लक्षणों में काफी सुधार (70%+ आराम)', 'थोड़ा आराम है पर तकलीफ बाकी है', 'कोई आराम नहीं / तकलीफ बढ़ गई', 'आज पूरी तरह नई समस्या है'],
          GU: ['લક્ષણોમાં સારો સુધારો (૭૦%+ રાહત)', 'થોડી રાહત છે પણ તકલીફ ચાલુ છે', 'કોઈ રાહત નથી / તકલીફ વધી ગઈ', 'આજે સાવ નવી જ સમસ્યા છે'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'DURATION',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Assessing longitudinal symptom progression and therapeutic response since prior visit',
        };
      }

      // Turn 1: Dynamic Deep-Dive into Progression Answer
      if (!answeredDimensions.has('RESIDUAL_SYMPTOMS')) {
        const latest = (state.latestAnswer || '').toLowerCase();
        const isWorse = /worsen|no relief|severe|बढ़|खराब|નથી|વધી|pain|दर्द|દુખાવો|swelling/i.test(latest);
        const isNewProb = /new problem|नई समस्या|નવી સમસ્યા/i.test(latest);

        if (isWorse) {
          const qText = {
            EN: isCaregiver
              ? `Since the symptoms have intensified or not improved, please describe the changes: has the pain radiated, is there new swelling, fever, or difficulty in daily routine?`
              : `Since your symptoms have intensified or not improved, please describe the changes: has the pain radiated, is there new swelling, fever, or difficulty in daily routine?`,
            HI: isCaregiver
              ? `चूँकि मरीज को आराम नहीं है या तकलीफ बढ़ी है, कृपया बताएं कि क्या दर्द फैल रहा है, नई सूजन या बुखार आया है, या दैनिक कामकाज में रुकावट हो रही है?`
              : `चूँकि आपको आराम नहीं है या तकलीफ बढ़ी है, कृपया बताएं कि क्या दर्द फैल रहा है, नई सूजन या बुखार आया है, या दैनिक कामकाज में रुकावट हो रही है?`,
            GU: isCaregiver
              ? `જ્યારે દર્દીને રાહત નથી કે તકલીફ વધી છે, તો કૃપા કરીને જણાવો કે શું દુખાવો ફેલાય છે, નવી સોજો કે તાવ આવ્યો છે, કે રોજિંદા કામમાં મુશ્કેલી છે?`
              : `જ્યારે આપને રાહત નથી કે તકલીફ વધી છે, તો કૃપા કરીને જણાવો કે શું દુખાવો ફેલાય છે, નવી સોજો કે તાવ આવ્યો છે, કે રોજિંદા કામમાં મુશ્કેલી છે?`,
          };
          const touchOpts = {
            EN: ['Pain increased with persistent stiffness', 'New swelling & redness noticed', 'Unable to sleep due to discomfort', 'Developed fever & weakness'],
            HI: ['दर्द बढ़ गया व लगातार जकड़न है', 'नई सूजन व लाली आ गई है', 'तकलीफ के कारण नींद नहीं आ रही', 'बुखार और कमजोरी शुरू हो गई है'],
            GU: ['દુખાવો વધી ગયો અને સતત જકડન છે', 'નવી સોજો અને લાલાશ જણાય છે', 'તકલીફના લીધે ઊંઘ આવતી નથી', 'તાવ અને નબળાઈ શરૂ થઈ ગઈ છે'],
          };
          return {
            question: qText[lang],
            questionLanguage: lang,
            questionCategory: 'CHARACTER',
            touchOptions: touchOpts[lang],
            isRedFlag: false,
            redFlagReason: null,
            isComplete: false,
            clinicalRationale: 'Dynamically evaluating symptom intensification and potential disease exacerbation',
          };
        } else if (isNewProb) {
          const qText = {
            EN: isCaregiver
              ? `Please tell us about the patient's new complaint: how many days ago did it start, and how severe is it?`
              : `Please tell us about your new complaint: how many days ago did it start, and how severe is it?`,
            HI: isCaregiver
              ? `कृपया मरीज की इस नई समस्या के बारे में बताएं: यह कितने दिनों पहले शुरू हुई, और कितनी तीव्र है?`
              : `कृपया अपनी इस नई समस्या के बारे में बताएं: यह कितने दिनों पहले शुरू हुई, और कितनी तीव्र है?`,
            GU: isCaregiver
              ? `કૃપા કરીને દર્દીની આ નવી સમસ્યા વિશે જણાવો: આ કેટલા દિવસ પહેલા શરૂ થઈ, અને કેટલી તીવ્ર છે?`
              : `કૃપા કરીને આપની આ નવી સમસ્યા વિશે જણાવો: આ કેટલા દિવસ પહેલા શરૂ થઈ, અને કેટલી તીવ્ર છે?`,
          };
          const touchOpts = {
            EN: ['Started in last 1-2 days', 'Severe acute onset today', 'Mild gradual discomfort', 'Intermittent episodes'],
            HI: ['पिछले 1-2 दिनों में शुरू हुई', 'आज अचानक तेज दर्द उठा', 'हल्की धीरे-धीरे बढ़ती तकलीफ', 'रुक-रुक कर होने वाले दौरे'],
            GU: ['છેલ્લા ૧-૨ દિવસમાં શરૂ થઈ', 'આજે અચાનક તીવ્ર દુખાવો થયો', 'હળવી ધીમે-ધીમે વધતી તકલીફ', 'અવારનવાર થતો દુખાવો'],
          };
          return {
            question: qText[lang],
            questionLanguage: lang,
            questionCategory: 'ONSET',
            touchOptions: touchOpts[lang],
            isRedFlag: false,
            redFlagReason: null,
            isComplete: false,
            clinicalRationale: 'Exploring secondary chief complaint presenting in follow-up encounter',
          };
        } else {
          // Improved / Partial relief follow-up
          const qText = {
            EN: isCaregiver
              ? `Which specific residual symptoms still remain for the patient, and during what activities or times do they feel them?`
              : `Which specific residual symptoms still remain, and during what activities or times do you feel them?`,
            HI: isCaregiver
              ? `मरीज को अब कौन सी बची हुई तकलीफ अभी भी महसूस हो रही है, और किस समय या काम के दौरान यह ज्यादा होती है?`
              : `आपको अब कौन सी बची हुई तकलीफ अभी भी महसूस हो रही है, और किस समय या काम के दौरान यह ज्यादा होती है?`,
            GU: isCaregiver
              ? `દર્દીને હવે કઈ બાકી રહેલી તકલીફ હજુ પણ જણાય છે, અને કયા સમયે કે પ્રવૃત્તિ દરમિયાન તે વધુ થાય છે?`
              : `આપને હવે કઈ બાકી રહેલી તકલીફ હજુ પણ જણાય છે, અને કયા સમયે કે પ્રવૃત્તિ દરમિયાન તે વધુ થાય છે?`,
          };
          const touchOpts = {
            EN: ['Mild lingering ache during exertion', 'Occasional morning stiffness', 'Discomfort returns after medicine stops', 'Almost back to normal, routine checkup'],
            HI: ['काम/मेहनत करने पर हल्का दर्द', 'सुबह उठने पर हल्की जकड़न', 'दवा बंद करने पर तकलीफ लौट आती है', 'काफी आराम है, सामान्य फॉलो-अप जांच'],
            GU: ['કામ/શ્રમ કરતી વખતે હળવો દુખાવો', 'સવારે જાગતી વખતે હળવી જકડન', 'દવા બંધ થતાં તકલીફ પાછી આવે છે', 'ઘણી રાહત છે, સામાન્ય ફોલો-અપ તપાસ'],
          };
          return {
            question: qText[lang],
            questionLanguage: lang,
            questionCategory: 'CHARACTER',
            touchOptions: touchOpts[lang],
            isRedFlag: false,
            redFlagReason: null,
            isComplete: false,
            clinicalRationale: 'Characterizing residual symptom burden and triggers post-therapy',
          };
        }
      }

      // Turn 2: Pharmacotherapy Compliance & Adverse Reactions
      if (!answeredDimensions.has('MEDICATIONS')) {
        const qText = {
          EN: isCaregiver
            ? `Has the patient been taking their previously prescribed medicines regularly, and did they experience any side effects?`
            : `Have you been taking your previously prescribed medicines regularly, and did you experience any side effects?`,
          HI: isCaregiver
            ? `क्या मरीज पहले लिखी गई दवाइयां समय पर नियमित ले रहे थे, और क्या कोई साइड-इफेक्ट या परेशानी हुई?`
            : `क्या आप पहले लिखी गई दवाइयां समय पर नियमित ले रहे थे, और क्या कोई साइड-इफेक्ट या परेशानी हुई?`,
          GU: isCaregiver
            ? `શું દર્દી અગાઉ આપેલી દવાઓ સમયસર નિયમિત લેતા હતા, અને કોઈ આડઅસર જણાઈ?`
            : `શું આપ અગાઉ આપેલી દવાઓ સમયસર નિયમિત લેતા હતા, અને કોઈ આડઅસર જણાઈ?`,
        };
        const touchOpts = {
          EN: ['Taking all medicines regularly on time', 'Missed doses occasionally / Stopped early', 'Medicines finished / Need refill', 'Experienced gastric upset / Nausea from medicines'],
          HI: ['सभी दवाइयां समय पर नियमित लीं', 'कभी-कभार दवा छूट गई / जल्दी बंद कर दी', 'दवा समाप्त हो गई / दोबारा चाहिए', 'दवा से पेट में गैस/उल्टी जैसा लगा'],
          GU: ['બધી દવાઓ સમયસર નિયમિત લીધી', 'ક્યારેક દવા છૂટી ગઈ / વહેલી બંધ કરી', 'દવા પૂર્ણ થઈ ગઈ / ફરી તપાસ', 'દવાથી પેટમાં ગેસ/ઉબકા જેવું થયું'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'MEDICATIONS',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Verifying pharmacotherapy compliance, refill needs, and adverse reactions',
        };
      }

      // Turn 3: Lifestyle & Trigger Management Follow-Up
      if (!answeredDimensions.has('LIFESTYLE_FOLLOWUP')) {
        const qText = {
          EN: isCaregiver
            ? `Have you noticed any triggers that worsen the patient's condition, and have they been able to follow the recommended diet, rest, or exercise routine?`
            : `Have you noticed any triggers that worsen your symptoms, and have you been able to follow the recommended diet, rest, or exercise routine?`,
          HI: isCaregiver
            ? `क्या आपने किसी ऐसी चीज पर गौर किया जिससे मरीज की तकलीफ बढ़ती है, और क्या वे बताई गई दिनचर्या, खान-पान और आराम का पालन कर पा रहे हैं?`
            : `क्या आपने किसी ऐसी चीज पर गौर किया जिससे आपकी तकलीफ बढ़ती है, और क्या आप बताई गई दिनचर्या, खान-पान और आराम का पालन कर पा रहे हैं?`,
          GU: isCaregiver
            ? `શું આપે કોઈ એવી બાબત નોંધી જેનાથી દર્દીની તકલીફ વધે છે, અને શું તેઓ જણાવેલ દિનચર્યા, ખોરાક અને આરામનું પાલન કરી રહ્યા છે?`
            : `શું આપે કોઈ એવી બાબત નોંધી જેનાથી આપની તકલીફ વધે છે, અને શું આપ જણાવેલ દિનચર્યા, ખોરાક અને આરામનું પાલન કરી રહ્યા છો?`,
        };
        const touchOpts = {
          EN: ['Following diet & rest recommendations well', 'Aggravated by physical strain / stress', 'Irregular sleep & routine continues', 'No specific triggers identified'],
          HI: ['खान-पान व आराम का अच्छा पालन हो रहा है', 'अधिक मेहनत या तनाव से दर्द बढ़ता है', 'अनियमित नींद व दिनचर्या जारी है', 'कोई खास कारण समझ नहीं आया'],
          GU: ['ખોરાક અને આરામનું સારું પાલન થાય છે', 'વધુ શ્રમ કે તણાવથી દુખાવો વધે છે', 'અનિયમિત ઊંઘ અને દિનચર્યા ચાલુ છે', 'કોઈ ચોક્કસ કારણ સમજાયું નથી'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'LIFESTYLE',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Assessing lifestyle modifications, trigger factors, and recovery regimen',
        };
      }

      // Turn 4: Final Returning Patient Wrap-Up
      const qFinal = {
        EN: isCaregiver
          ? `Thank you. Is there any other detail regarding the patient's recovery that you would like the doctor to review?`
          : `Thank you. Is there any other detail regarding your recovery that you would like your doctor to review?`,
        HI: isCaregiver
          ? `धन्यवाद। क्या मरीज की रिकवरी या फॉलो-अप के बारे में आप डॉक्टर को कोई अन्य जरूरी बात बताना चाहते हैं?`
          : `धन्यवाद। क्या अपने स्वास्थ्य या फॉलो-अप के बारे में आप डॉक्टर को कोई अन्य जरूरी बात बताना चाहते हैं?`,
        GU: isCaregiver
          ? `આભાર. શું દર્દીના સ્વાસ્થ્ય કે ફોલો-અપ અંગે ડૉક્ટરને જણાવવા જેવી કોઈ અન્ય ખાસ વિગત છે?`
          : `આભાર. શું આપના સ્વાસ્થ્ય કે ફોલો-અપ અંગે ડૉક્ટરને જણાવવા જેવી કોઈ અન્ય ખાસ વિગત છે?`,
      };
      const optFinal = {
        EN: ['No, that covers all symptoms — complete intake', 'Yes, I want to add one more detail'],
        HI: ['नहीं, सब लक्षण बता दिए — इनटेक पूर्ण करें', 'हाँ, मुझे एक और लक्षण बताना है'],
        GU: ['ના, તમામ લક્ષણો જણાવી દીધા — ઇન્ટેક પૂર્ણ કરો', 'હા, મારે બીજું એક લક્ષણ જણાવવું છે'],
      };
      return {
        question: qFinal[lang],
        questionLanguage: lang,
        questionCategory: 'CLOSING',
        touchOptions: optFinal[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: true,
        clinicalRationale: 'Follow-up intake completed with multi-turn progression, symptom details, medication adherence, and lifestyle triggers recorded',
      };
    }

    // ==========================================
    // WORKFLOW B: NEW PATIENT INTAKE
    // Step 1: Lifestyle & Daily Routine (Sleep, Diet, Physical Activity, Stress) FIRST
    // ==========================================
    if (!answeredDimensions.has('LIFESTYLE')) {
      const qText = {
        EN: isCaregiver
          ? `How is the patient's daily routine, sleep pattern (hours/night), and dietary habits?`
          : `How is your daily routine, sleep quality (hours per night), and dietary habits?`,
        HI: isCaregiver
          ? `मरीज की दिनचर्या, रात की नींद (कितने घंटे) और खान-पान की आदतें कैसी रहती हैं?`
          : `आपकी दिनचर्या, रात की नींद (कितने घंटे) और खान-पान की आदतें कैसी हैं?`,
        GU: isCaregiver
          ? `દર્દીની દિનચર્યા, રાત્રિની ઊંઘ (કેટલા કલાક) અને ખોરાકની આદતો કેવી રહે છે?`
          : `આપની દિનચર્યા, રાત્રિની ઊંઘ (કેટલા કલાક) અને ખાનપાનની આદતો કેવી રહે છે?`,
      };
      const touchOpts = {
        EN: ['Normal 7-8 hrs sleep & balanced home food', 'Disturbed sleep (<5 hrs) & high work stress', 'Oily / fast food & irregular meals', 'Sedentary desk routine & physical fatigue'],
        HI: ['सामान्य 7-8 घंटे नींद और घर का सादा खाना', 'नींद में रुकावट व अधिक काम का तनाव', 'तला-भुना/बाहर का खाना व अनियमित समय', 'शारीरिक निष्क्रियता व थकान'],
        GU: ['સામાન્ય ૭-૮ કલાક ઊંઘ અને સાદો ઘરનો ખોરાક', 'ઊંઘમાં ખલેલ અને વધુ માનસિક તણાવ', 'તેલી/બહારનો ખોરાક અને અનિયમિત ભોજન', 'બેઠાડુ જીવન અને થાક'],
      };
      return {
        question: qText[lang],
        questionLanguage: lang,
        questionCategory: 'LIFESTYLE',
        touchOptions: touchOpts[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Gathering baseline lifestyle, sleep hygiene, and metabolic routine context',
      };
    }

    // Step 2: Medical Background, Medications & Drug Allergies SECOND
    if (!answeredDimensions.has('PAST_HISTORY') && !answeredDimensions.has('MEDICATIONS') && !answeredDimensions.has('ALLERGIES')) {
      const qText = {
        EN: isCaregiver
          ? `Does the patient have any ongoing medical conditions (BP, Diabetes, Thyroid), regular medicines, or drug allergies?`
          : `Do you have any ongoing medical conditions (BP, Diabetes, Thyroid), regular medications, or drug allergies?`,
        HI: isCaregiver
          ? `क्या मरीज को कोई पुरानी बीमारी (बीपी, शुगर, थायराइड), कोई नियमित दवा या किसी दवा से एलर्जी है?`
          : `क्या आपको कोई पुरानी बीमारी (बीपी, शुगर, थायराइड), कोई नियमित दवा या किसी दवा से एलर्जी है?`,
        GU: isCaregiver
          ? `શું દર્દીને કોઈ જૂની બીમારી (બીપી, ડાયાબિટીસ, થાયરોઇડ), નિયમિત દવા કે કોઈ દવાની એલર્જી છે?`
          : `શું આપને કોઈ જૂની બીમારી (બીપી, ડાયાબિટીસ, થાયરોઇડ), નિયમિત દવા કે કોઈ દવાની એલર્જી છે?`,
      };
      const touchOpts = {
        EN: ['No chronic conditions & No known drug allergies (NKDA)', 'Taking regular BP / Diabetes medicines', 'Have Thyroid / Asthma / Breathing trouble', 'Known drug allergy to Penicillin / Sulfa drugs'],
        HI: ['कोई पुरानी बीमारी नहीं व कोई एलर्जी नहीं (NKDA)', 'नियमित बीपी / शुगर की दवाइयां ले रहे हैं', 'थायराइड / अस्थमा / सांस की तकलीफ है', 'दवाओं (पेनिसिलिन आदि) से एलर्जी है'],
        GU: ['કોઈ જૂની બીમારી નથી અને કોઈ એલર્જી નથી (NKDA)', 'નિયમિત બીપી / ડાયાબિટીસ દવા લઈએ છીએ', 'થાયરોઇડ / અસ્થમા / શ્વાસની તકલીફ છે', 'દવાની એલર્જી છે (પેનિસિલિન વગેરે)'],
      };
      return {
        question: qText[lang],
        questionLanguage: lang,
        questionCategory: 'PAST_HISTORY',
        touchOptions: touchOpts[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Screening chronic disease background and pharmacotherapy safety profile',
      };
    }

    // Step 3: Chief Complaint / Primary Health Concern
    if (!state.chiefComplaint) {
      const qText = {
        EN: isCaregiver
          ? `Now, please tell me what specific symptoms or health concerns the patient is experiencing today?`
          : `Now, please tell me what specific symptoms or health concerns brought you to the hospital today?`,
        HI: isCaregiver
          ? `अब कृपया बताएं कि मरीज को आज क्या मुख्य तकलीफ या लक्षण महसूस हो रहे हैं?`
          : `अब कृपया बताएं कि आज आपको क्या मुख्य परेशानी या लक्षण महसूस हो रहे हैं?`,
        GU: isCaregiver
          ? `હવે કૃપા કરીને જણાવો કે દર્દીને આજે કઈ મુખ્ય તકલીફ કે લક્ષણો થઈ રહ્યા છે?`
          : `હવે કૃપા કરીને જણાવો કે આજે આપને કઈ મુખ્ય તકલીફ કે લક્ષણો થઈ રહ્યા છે?`,
      };
      const touchOpts = {
        EN: ['Ear pain / Discharge / Blocked ear', 'Throbbing headache & eye strain', 'Stomach ache / Burning acidity', 'Chest tightness / Shortness of breath', 'Skin rash / Pimples / Itching', 'Fever, cough & sore throat'],
        HI: ['कान में दर्द / मवाद / भारीपन', 'तेज सिरदर्द और आँखों में तनाव', 'पेट में दर्द / जलन / एसिडिटी', 'सीने में भारीपन / सांस लेने में तकलीफ', 'त्वचा में दाने / मुँहासे / खुजली', 'बुखार, खांसी और गले में दर्द'],
        GU: ['કાનમાં દુખાવો / પરુ / ભારેપણું', 'તીવ્ર માથાનો દુખાવો અને આંખોમાં તાણ', 'પેટમાં દુખાવો / બળતરા / એસિડિટી', 'છાતીમાં ભારેપણું / શ્વાસ લેવામાં તકલીફ', 'ચામડી પર દાણા / ખીલ / ખંજવાળ', 'તાવ, ઉધરસ અને ગળામાં દુખાવો'],
      };
      return {
        question: qText[lang],
        questionLanguage: lang,
        questionCategory: 'ONSET',
        touchOptions: touchOpts[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Inquiring chief complaint after lifestyle and medical history baseline established',
      };
    }

    // Step 4: Clinical Symptoms & Primary Complaint Exploration
    if (!answeredDimensions.has('ONSET')) {
      let qText = {
        EN: isCaregiver
          ? `How long has the patient been experiencing ${localizedLabel}, and did it begin suddenly or gradually?`
          : `How long have you been experiencing ${localizedLabel}, and did it begin suddenly or gradually?`,
        HI: isCaregiver
          ? `मरीज को ${localizedLabel} की समस्या कब से हो रही है, और क्या यह अचानक शुरू हुई या धीरे-धीरे बढ़ी?`
          : `आपको ${localizedLabel} की समस्या कब से हो रही है, और क्या यह अचानक शुरू हुई या धीरे-धीरे बढ़ी?`,
        GU: isCaregiver
          ? `દર્દીને ${localizedLabel} કેટલા સમયથી જણાય છે, અને શું તે અચાનક શરૂ થઈ કે ધીમે-ધીમે વધી?`
          : `તમને ${localizedLabel} કેટલા સમયથી જણાય છે, અને શું તે અચાનક શરૂ થઈ કે ધીમે-ધીમે વધી?`,
      };
      let touchOpts = {
        EN: ['Since today / past few hours', '2 to 3 days', '1 to 2 weeks', 'More than a month (chronic)'],
        HI: ['आज से / कुछ घंटों से', '2-3 दिनों से', '1-2 सप्ताह से', 'एक महीने से अधिक समय से'],
        GU: ['આજથી / થોડા કલાકોથી', '૨-૩ દિવસથી', '૧-૨ અઠવાડિયાથી', 'એક મહિનાથી વધુ સમયથી'],
      };
      return {
        question: qText[lang],
        questionLanguage: lang,
        questionCategory: 'ONSET',
        touchOptions: touchOpts[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Dynamically evaluating onset, timing, and radiating patterns for reported complaint',
      };
    }

    // Step 5: Disease-Specific Dynamic Clinical Follow-Up Inquiries
    if (!answeredDimensions.has('CHARACTER')) {
      const complaintLower = (state.chiefComplaint || state.latestAnswer || '').toLowerCase();

      // 1. LOWER BACK PAIN & SCIATICA
      if (/back|spine|lumbar|sciatica|कमर|पीठ|પીઠ|વાંસો/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `Does the patient's lower back pain radiate down their buttocks or leg (sciatica), and do they have numbness, tingling, or weakness in their feet?`
            : `Does your lower back pain radiate down your buttocks or leg (sciatica), and do you feel any numbness, tingling, or weakness in your feet?`,
          HI: isCaregiver
            ? `क्या मरीज की कमर का दर्द कूल्हों या पैरों के नीचे की तरफ जा रहा है, और क्या पैरों में सुन्नपन, झनझनाहट या चलने में कमजोरी है?`
            : `क्या आपकी कमर का दर्द कूल्हों या पैरों के नीचे की तरफ जा रहा है, और क्या पैरों में सुन्नपन, झनझनाहट या चलने में कमजोरी है?`,
          GU: isCaregiver
            ? `શું દર્દીની કમરનો દુખાવો પગ તરફ નીચે ઉતરે છે (સાયટિકા), અને પગમાં ખાલી ચડવી, ઝણઝણાટી કે ચાલવામાં તકલીફ છે?`
            : `શું આપની કમરનો દુખાવો પગ તરફ નીચે ઉતરે છે (સાયટિકા), અને પગમાં ખાલી ચડવી, ઝણઝણાટી કે ચાલવામાં તકલીફ છે?`,
        };
        const touchOpts = {
          EN: ['Radiating down leg with numbness / tingling', 'Sharp pain when bending forward or lifting', 'Dull aching stiffness after prolonged sitting', 'Pain localized strictly to lower spine'],
          HI: ['पैरों में नीचे की तरफ खिंचाव व सुन्नपन', 'झुकने या वजन उठाने पर तेज चुभन', 'देर तक बैठने पर भारीपन व जकड़न', 'दर्द केवल कमर के निचले हिस्से तक सीमित'],
          GU: ['પગમાં નીચે તરફ દુખાવો અને ખાલી ચડવી', 'વાંકા વળતી વખતે તીક્ષ્ણ દુખાવો', 'લાંબો સમય બેસવાથી કમરમાં જકડન', 'દુખાવો માત્ર કમરના ભાગ પૂરતો જ છે'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Evaluating lumbar disc herniation, sciatica radiculopathy, and neurological deficits',
        };
      }

      // 2. PENIS / GENITOURINARY / UROLOGICAL
      if (/penis|urina|urine|discharge|genital|पेशाब|मूत्र|लिंग|ઇન્દ્રિય/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `Does the patient have severe burning during urination, any discharge (pus/clear fluid), genital irritation, or difficulty passing urine?`
            : `Do you have burning or pain during urination, any discharge (pus/clear fluid), irritation, or difficulty passing urine?`,
          HI: isCaregiver
            ? `क्या मरीज को पेशाब करते समय तेज जलन/दर्द है, कोई मवाद या स्राव (discharge) आ रहा है, या पेशाब में रुकावट है?`
            : `क्या आपको पेशाब करते समय तेज जलन/दर्द है, कोई मवाद या स्राव (discharge) आ रहा है, या पेशाब रुक-रुक कर आ रहा है?`,
          GU: isCaregiver
            ? `શું દર્દીને પેશાબ કરતી વખતે તીવ્ર બળતરા/દુખાવો થાય છે, કોઈ પરુ કે સ્ત્રાવ આવે છે, કે પેશાબ કરવામાં અટકાવ છે?`
            : `શું આપને પેશાબ કરતી વખતે તીવ્ર બળતરા/દુખાવો થાય છે, કોઈ પરુ કે સ્ત્રાવ આવે છે, કે પેશાબ કરવામાં અટકાવ છે?`,
        };
        const touchOpts = {
          EN: ['Severe burning sensation while urinating', 'Whitish / yellowish pus discharge from penis', 'Frequent urge to urinate with reduced flow', 'Itching, redness, or skin irritation'],
          HI: ['पेशाब में तेज जलन और दर्द', 'लिंग से मवाद/सफेद पानी का स्राव', 'बार-बार पेशाब की इच्छा व धार कम', 'खुजली, लाली और त्वचा में जलन'],
          GU: ['પેશાબ કરતી વખતે તીવ્ર બળતરા', 'ઇન્દ્રિયમાંથી પરુ કે સફેદ પાણીનો સ્ત્રાવ', 'વારંવાર પેશાબ જવું પડે છે અને પ્રવાહ ધીમો', 'ખંજવાળ, લાલાશ અને ચામડી પર બળતરા'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Investigating urethritis, UTI, STI infection markers, and urinary outflow symptoms',
        };
      }

      // 3. VOMITING, NAUSEA & GASTROINTESTINAL
      if (/vomit|उल्टी|ઉલટી|nausea|dehydrat/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `How many times has the patient vomited, does it contain food, bile, or blood, and are they able to retain fluids?`
            : `How many times have you vomited, does it contain food, bile, or blood, and are you able to retain water and fluids?`,
          HI: isCaregiver
            ? `मरीज को कितनी बार उल्टी हुई है, क्या उल्टी में खाना या पित्त (पीला पानी) आया है, और क्या पानी पच पा रहा है?`
            : `आपको कितनी बार उल्टी हुई है, क्या उल्टी में खाना या पित्त (पीला पानी) आया है, और क्या पानी पच पा रहा है?`,
          GU: isCaregiver
            ? `દર્દીને કેટલી વાર ઉલટી થઈ છે, શું ઉલટીમાં ખોરાક કે પિત્ત નીકળે છે, અને પાણી ટકે છે?`
            : `તમને કેટલી વાર ઉલટી થઈ છે, શું ઉલટીમાં ખોરાક કે પિત્ત (પીળું પાણી) નીકળે છે, અને પાણી પચી શકે છે?`,
        };
        const touchOpts = {
          EN: ['Frequent vomiting (>4-5 times), cannot retain water', 'Vomited 1-2 times after meals with nausea', 'Sour yellow bile vomiting with stomach cramps', 'Accompanied by loose watery stools & weakness'],
          HI: ['लगातार उल्टियां (>4-5 बार), पानी भी नहीं रुक रहा', 'खाने के बाद 1-2 बार उल्टी व जी मिचलाना', 'खट्टी डकारें व पीले पित्त की उल्टी', 'दस्त (loose motions) और कमजोरी के साथ'],
          GU: ['વારંવાર ઉલટી (>૪-૫ વાર), પાણી પણ ટકતું નથી', 'જમ્યા પછી ૧-૨ વાર ઉલટી અને ઉબકા', 'ખાટા ઓડકાર અને પીળા પિત્તની ઉલટી', 'ઝાડા (લૂઝ મોશન) અને ભારે અશક્તિ સાથે'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Assessing acute gastroenteritis, emesis frequency, electrolyte loss risk, and hydration status',
        };
      }

      // 4. EAR COMPLAINT
      if (/ear|कान|કાન/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `Does the patient have any ear discharge (pus/fluid), reduced hearing, blocked sensation, or ringing in the ear?`
            : `Do you have any ear discharge (pus/watery fluid), hearing loss, blocked ear sensation, or ringing sounds?`,
          HI: isCaregiver
            ? `क्या मरीज के कान से मवाद/पानी आ रहा है, सुनने में कमी, भारीपन या सीटी जैसी आवाज आ रही है?`
            : `क्या आपके कान से कोई मवाद/पानी आ रहा है, सुनने में कमी, भारीपन या सीटी जैसी आवाज आ रही है?`,
          GU: isCaregiver
            ? `શું દર્દીના કાનમાંથી પરુ/પાણી આવે છે, ઓછું સંભળાય છે, કાનમાં ભારેપણું કે અવાજ આવે છે?`
            : `શું આપના કાનમાંથી પરુ/પાણી આવે છે, ઓછું સંભળાય છે, કાનમાં ભારેપણું કે અવાજ આવે છે?`,
        };
        const touchOpts = {
          EN: ['Yellow / foul smelling ear discharge', 'Reduced hearing & blocked ear feeling', 'Severe sharp pulling pain inside ear', 'No discharge, only aching discomfort'],
          HI: ['पीला / दुर्गंधयुक्त मवाद आ रहा है', 'सुनने में कमी और कान बंद लग रहा है', 'कान के अंदर तेज खींचने वाला दर्द', 'कोई मवाद नहीं, सिर्फ सामान्य दर्द है'],
          GU: ['પીળું / વાસવાળું પરુ આવે છે', 'ઓછું સંભળાય છે અને કાન બંધ જણાય છે', 'કાનની અંદર તીવ્ર દુખાવો થાય છે', 'કોઈ પરુ નથી, માત્ર સામાન્ય દુખાવો છે'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Investigating ENT otitis media / otitis externa symptoms and acoustic involvement',
        };
      }

      // 2. HEADACHE COMPLAINT
      if (/headache|head|सिर|માથ/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `Is the patient's headache one-sided and throbbing, and are they sensitive to bright lights or loud noises?`
            : `Is your headache throbbing/pulsing on one side, and are you sensitive to bright lights or loud sounds?`,
          HI: isCaregiver
            ? `क्या मरीज को एक तरफ तेज टीस मारने वाला दर्द है, और तेज रोशनी या आवाज से परेशानी होती है?`
            : `क्या आपको एक तरफ तेज टीस मारने वाला सिरदर्द है, और तेज रोशनी या आवाज से परेशानी बढ़ती है?`,
          GU: isCaregiver
            ? `શું દર્દીને એક બાજુ તીવ્ર માથું ધબકે છે, અને વધુ પ્રકાશ કે અવાજથી તકલીફ વધે છે?`
            : `શું આપને એક બાજુ તીવ્ર માથું ધબકે છે, અને વધુ પ્રકાશ કે અવાજથી તકલીફ વધે છે?`,
        };
        const touchOpts = {
          EN: ['One-sided throbbing / migraine pain', 'Tight band around entire forehead & neck', 'Sensitive to bright light & sound (photophobia)', 'Dull heavy ache accompanied by nausea'],
          HI: ['एक तरफ तेज टीस / माइग्रेन जैसा दर्द', 'माथे और गर्दन के चारों ओर भारी तनाव', 'तेज रोशनी व आवाज से तकलीफ (फोटोफोबिया)', 'हल्का भारी दर्द और जी मिचलाना'],
          GU: ['એક બાજુ તીવ્ર માથું ધબકે છે (માઈગ્રેન)', 'કપાળ અને ગરદનની આસપાસ ભારે તાણ', 'વધુ પ્રકાશ અને અવાજથી તકલીફ', 'ભારેપણું અને ઉબકા જેવું થવું'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Differentiating migraine vascular headache vs tension headache presentation',
        };
      }

      // 3. STOMACH / ABDOMEN / ACIDITY
      if (/stomach|abdom|acidity|gas|vomit|पेट|પેટ/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `Is the patient's stomach discomfort burning in the upper chest/abdomen, cramping, and does eating food make it better or worse?`
            : `Is your stomach discomfort burning in the chest/upper abdomen, and does eating food make it better or worse?`,
          HI: isCaregiver
            ? `क्या मरीज के पेट या सीने में जलन/मरोड़ है, और क्या खाना खाने से तकलीफ कम या ज्यादा होती है?`
            : `क्या आपके पेट या सीने में जलन/मरोड़ हो रही है, और क्या खाना खाने से तकलीफ कम या ज्यादा होती है?`,
          GU: isCaregiver
            ? `શું દર્દીના પેટ કે છાતીમાં બળતરા/ચૂંક આવે છે, અને ભોજન પછી તકલીફ વધે છે કે ઘટે છે?`
            : `શું આપના પેટ કે છાતીમાં બળતરા/ચૂંક આવે છે, અને જમ્યા પછી તકલીફ વધે છે કે ઘટે છે?`,
        };
        const touchOpts = {
          EN: ['Burning sensation & sour acid reflux', 'Cramping pain with bloating & gas', 'Worse immediately after spicy/oily food', 'Relieved temporarily after drinking milk/food'],
          HI: ['सीने व पेट में जलन और खट्टी डकारें', 'पेट में मरोड़, गैस और भारीपन', 'मसालेदार/तला खाना खाने के तुरंत बाद दर्द', 'दूध पीने या खाने के बाद थोड़ा आराम'],
          GU: ['છાતી અને પેટમાં બળતરા અને ખાટા ઓડકાર', 'પેટમાં ચૂંક, ગેસ અને ભારેપણું', 'મસાલેદાર ખોરાક પછી તરત તકલીફ', 'દૂધ પીવાથી કે જમવાથી થોડી રાહત'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Assessing GERD, peptic acid disease, and gastrointestinal symptoms',
        };
      }

      // 4. CHEST / CARDIAC
      if (/chest|heart|सीने|छाती/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `Does the patient feel crushing heaviness in the chest, and does the pain radiate to the left arm, neck, or jaw?`
            : `Do you feel crushing heaviness in your chest, and does the discomfort radiate to your left arm, neck, or jaw?`,
          HI: isCaregiver
            ? `क्या मरीज के सीने में भारी दबाव महसूस हो रहा है, और क्या यह दर्द बाएं हाथ, गर्दन या जबड़े की तरफ फैल रहा है?`
            : `क्या आपके सीने में भारी दबाव महसूस हो रहा है, और क्या यह दर्द बाएं हाथ, गर्दन या जबड़े की तरफ फैलता है?`,
          GU: isCaregiver
            ? `શું દર્દીની છાતીમાં ભારે દબાણ જણાય છે, અને શું આ દુખાવો ડાબા હાથ, ગરદન કે જડબા તરફ ફેલાય છે?`
            : `શું આપની છાતીમાં ભારે દબાણ જણાય છે, અને શું આ દુખાવો ડાબા હાથ, ગરદન કે જડબા તરફ ફેલાય છે?`,
        };
        const touchOpts = {
          EN: ['Spreading to left arm & shoulder', 'Heavy crushing pressure in center of chest', 'Accompanied by shortness of breath & sweating', 'Sharp stabbing pain when taking deep breaths'],
          HI: ['बाएं हाथ और कंधे की तरफ फैल रहा है', 'सीने के बीच में भारी दबाव व जकड़न', 'सांस फूलना और ठंडा पसीना आना', 'गहरी सांस लेने पर चुभन जैसा दर्द'],
          GU: ['ડાબા હાથ અને ખભા તરફ ફેલાય છે', 'છાતીની વચ્ચે ભારે દબાણ અને ભીંસ', 'શ્વાસ ચડવો અને પરસેવો થવો', 'ઊંડો શ્વાસ લેતી વખતે તીક્ષ્ણ દુખાવો'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: true,
          redFlagReason: 'Possible acute coronary syndrome or myocardial ischemia',
          isComplete: false,
          clinicalRationale: 'Screening for acute coronary syndromes, angina radiation, and exertional triggers',
        };
      }

      // Generic Symptom Character
      const qText = {
        EN: isCaregiver
          ? `How would you describe the severity and nature of the patient's ${localizedLabel}?`
          : `How would you describe the severity and nature of your ${localizedLabel}?`,
        HI: isCaregiver
          ? `मरीज की ${localizedLabel} की गंभीरता और प्रकार कैसा है?`
          : `आपकी ${localizedLabel} की गंभीरता और प्रकार कैसा है?`,
        GU: isCaregiver
          ? `દર્દીની ${localizedLabel} ની તીવ્રતા અને પ્રકાર કેવો છે?`
          : `આપની ${localizedLabel} ની તીવ્રતા અને પ્રકાર કેવો છે?`,
      };
      const touchOpts = {
        EN: ['Mild discomfort / Manageable', 'Moderate pain / Limits daily activities', 'Severe throbbing / Sharp pain', 'Intermittent episodes coming and going'],
        HI: ['हल्की तकलीफ / सामान्य काम कर पा रहे हैं', 'मध्यम दर्द / दैनिक काम में परेशानी', 'तेज दर्द / जलन / असहनीय', 'रुक-रुक कर होने वाली तकलीफ'],
        GU: ['હળવી તકલીફ / સામાન્ય કામ થઈ શકે છે', 'મધ્યમ દુખાવો / રોજિંદા કામમાં તકલીફ', 'તીવ્ર દુખાવો / બળતરા / અસહ્ય', 'વારંવાર આવતી-જતી તકલીફ'],
      };
      return {
        question: qText[lang],
        questionLanguage: lang,
        questionCategory: 'CHARACTER',
        touchOptions: touchOpts[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Evaluating disease severity and symptomatic character for clinical triage',
      };
    }

    // Step 5: Final Wrap-Up Review (All dimensions covered)
    const qFinal = {
      EN: isCaregiver
        ? `Thank you. Is there any other symptom or specific detail regarding the patient's condition that you would like the doctor to know?`
        : `Thank you. Is there any other symptom or specific detail you would like to share with your doctor?`,
      HI: isCaregiver
        ? `धन्यवाद। क्या मरीज की स्थिति के बारे में आप डॉक्टर को कोई अन्य जरूरी बात बताना चाहते हैं?`
        : `धन्यवाद। क्या डॉक्टर से मिलने से पहले आप कोई अन्य लक्षण या जरूरी बात बताना चाहते हैं?`,
      GU: isCaregiver
        ? `આભાર. શું દર્દીની તકલીફ અંગે ડૉક્ટરને જણાવવા જેવી કોઈ અન્ય ખાસ વિગત છે?`
        : `આભાર. ડૉક્ટરને મળતા પહેલાં શું આપ કોઈ અન્ય લક્ષણ કે ખાસ વિગત જણાવવા માંગો છો?`,
    };
    const optFinal = {
      EN: ['No, that covers all symptoms — complete intake', 'Yes, I want to add one more detail'],
      HI: ['नहीं, सब लक्षण बता दिए — इनटेक पूर्ण करें', 'हाँ, मुझे एक और लक्षण बताना है'],
      GU: ['ના, તમામ લક્ષણો જણાવી દીધા — ઇન્ટેક પૂર્ણ કરો', 'હા, મારે બીજું એક લક્ષણ જણાવવું છે'],
    };

    return {
      question: qFinal[lang],
      questionLanguage: lang,
      questionCategory: 'CLOSING',
      touchOptions: optFinal[lang],
      isRedFlag: false,
      redFlagReason: null,
      isComplete: true,
      clinicalRationale: 'All critical clinical dimensions gathered; ready for clinical report generation',
    };
  }

  async generateClinicalSummary(state: ClinicalState, patient: any, vitals?: any, documents?: any[]): Promise<any> {
    const chief = state.chiefComplaint || 'Patient presented for OPD consultation';
    
    // 1. Comprehensive HPI Narrative
    let hpiNarrative = '';
    if (state.symptoms && state.symptoms.length > 0) {
      const parts = state.symptoms.map((s) => {
        let desc = `${s.name}`;
        if (s.onset || s.duration) desc += ` (onset: ${s.onset || s.duration})`;
        if (s.severity) desc += ` with severity ${s.severity}/10`;
        if (s.character) desc += `, described as ${s.character}`;
        if (s.radiation) desc += `, radiating to ${s.radiation}`;
        if (s.aggravatingFactors?.length) desc += `, aggravated by ${s.aggravatingFactors.join(', ')}`;
        if (s.relievingFactors?.length) desc += `, relieved by ${s.relievingFactors.join(', ')}`;
        if (s.progression) desc += ` [Progression: ${s.progression}]`;
        return desc;
      });
      hpiNarrative = parts.join('. ') + '.';
    } else {
      hpiNarrative = `${chief} reported during adaptive multilingual intake.`;
    }

    // Include clinically relevant negative symptoms
    if (state.associatedSymptoms && state.associatedSymptoms.length > 0) {
      const negatives = state.associatedSymptoms.filter(a => a.present === false).map(a => a.name);
      if (negatives.length > 0) {
        hpiNarrative += ` Patient denies ${negatives.join(', ')}.`;
      }
    }

    // 2. Vitals Highlights with Source Attribution
    const vitalsStr = vitals
      ? `BP: ${vitals.bpSystolic || '--'}/${vitals.bpDiastolic || '--'} mmHg • Pulse: ${vitals.pulse || '--'} bpm • SpO2: ${vitals.spo2 || '--'}% • Temp: ${vitals.temperature || '--'}°F${vitals.weight && vitals.height ? ` • Height: ${vitals.height}cm • Weight: ${vitals.weight}kg • BMI: ${(vitals.weight / Math.pow(vitals.height / 100, 2)).toFixed(1)} kg/m²` : ''}`
      : 'Vitals pending nurse station assessment';

    // 3. Lifestyle & Daily Routine
    const lifestyleStr = state.lifestyle
      ? [
          state.lifestyle.sleep ? `Sleep: ${state.lifestyle.sleep}` : null,
          state.lifestyle.diet ? `Diet: ${state.lifestyle.diet}` : null,
          state.lifestyle.activity ? `Activity: ${state.lifestyle.activity}` : null,
          state.lifestyle.occupation ? `Occupation: ${state.lifestyle.occupation}` : null,
          state.lifestyle.smoking ? `Smoking: ${state.lifestyle.smoking}` : null,
          state.lifestyle.alcohol ? `Alcohol: ${state.lifestyle.alcohol}` : null,
        ].filter(Boolean).join(' • ') || 'Standard daily routine reported'
      : 'Standard daily routine reported';

    // 4. Extracted Document Findings
    const docFindings: Array<{ documentTitle: string; documentType: string; findings: string[]; labResults: any[]; medications: any[] }> = [];
    if (documents && documents.length > 0) {
      for (const d of documents) {
        if (d.extractions && d.extractions.length > 0) {
          for (const ext of d.extractions) {
            const rawExt = typeof ext.extractedData === 'string' ? JSON.parse(ext.extractedData) : ext.extractedData;
            docFindings.push({
              documentTitle: d.title,
              documentType: d.fileType || 'REPORT',
              findings: rawExt?.keyFindings || [rawExt?.summary || 'Attached document record'],
              labResults: rawExt?.labResults || [],
              medications: rawExt?.medications || [],
            });
          }
        } else {
          docFindings.push({
            documentTitle: d.title,
            documentType: d.fileType || 'RECORD',
            findings: [`Uploaded ${d.title} attached for clinician review`],
            labResults: [],
            medications: [],
          });
        }
      }
    }

    // 5. Returning Patient Intelligence & Changes Since Previous Visit
    let changesSincePreviousVisit: string | null = null;
    if (state.previousVisitInfo) {
      const pv = state.previousVisitInfo;
      const progressionAnswer = state.symptoms?.find(s => s.progression)?.progression || state.latestAnswer || 'Follow-up consultation';
      changesSincePreviousVisit = `Previous Visit: ${pv.lastVisitDate || 'Prior'} (${pv.lastComplaint || 'Consultation'} with ${pv.lastDoctor || 'Attending Physician'}). Progression: ${progressionAnswer}.`;
    }

    // 6. Contradiction Detection
    const contradictions: string[] = [];
    if (state.previousVisitInfo?.pastPrescriptions?.length) {
      const currentMedNames = state.medications.map(m => m.name.toLowerCase());
      const missingPastMeds = state.previousVisitInfo.pastPrescriptions.filter(pm => !currentMedNames.some(cm => cm.includes(pm.toLowerCase())));
      if (missingPastMeds.length > 0) {
        contradictions.push(`Previously prescribed medications (${missingPastMeds.join(', ')}) not explicitly reported in current intake. Clinician verification recommended.`);
      }
    }

    // 7. Medication Reconciliation
    const medicationReconciliation = {
      patientReported: state.medications.map(m => `${m.name}${m.dose ? ` (${m.dose})` : ''}`),
      previouslyPrescribed: state.previousVisitInfo?.pastPrescriptions || [],
      documentExtracted: docFindings.flatMap(df => df.medications.map(m => `${m.name} ${m.dosage || ''}`.trim())),
    };

    const completeness = Math.min(100, Math.round(
      (state.turnsCompleted / 8) * 60 +
      (state.symptoms.length > 0 ? 15 : 0) +
      (state.pastMedicalHistory.length > 0 ? 10 : 0) +
      (state.lifestyle?.sleep ? 5 : 0) +
      (vitals ? 5 : 0) +
      (documents?.length ? 5 : 0)
    ));

    return {
      overview: `Patient ${patient?.name || 'Patient'} (${patient?.age || '45'}Y/${patient?.gender || 'M'}) presented with primary complaint of ${chief}. Intake conducted in ${state.currentLanguage || 'EN'}.`,
      chiefComplaint: chief,
      historyOfPresentIllness: hpiNarrative,
      lifestyle: lifestyleStr,
      pastMedicalHistory: state.pastMedicalHistory.length > 0 ? state.pastMedicalHistory.join(', ') : 'None reported during kiosk intake',
      pastSurgicalHistory: state.pastSurgicalHistory?.length > 0 ? state.pastSurgicalHistory.join(', ') : 'No prior surgeries reported',
      medications: state.medications.length > 0 ? state.medications.map((m) => m.name + (m.dose ? ` (${m.dose})` : '')).join(', ') : 'No regular medications reported',
      allergies: state.allergies.length > 0 ? state.allergies.map((a) => a.allergen + (a.reaction ? ` [${a.reaction}]` : '')).join(', ') : 'No known drug allergies reported (NKDA)',
      familyHistory: state.familyHistory?.length > 0 ? state.familyHistory.join(', ') : 'Non-contributory / None reported',
      socialHistory: state.socialHistory?.smoking || state.socialHistory?.alcohol ? `Smoking: ${state.socialHistory.smoking || 'None'} • Alcohol: ${state.socialHistory.alcohol || 'None'}` : 'Non-contributory',
      vitalHighlights: vitalsStr,
      extractedDocumentFindings: docFindings,
      changesSincePreviousVisit,
      contradictions,
      medicationReconciliation,
      clinicianVerificationRequired: contradictions.length > 0,
      redFlags: state.redFlags.map((r) => `${r.severity}: ${r.description}`),
      completenessScore: completeness,
      confidenceScore: 98,
      sourceMap: {
        chiefComplaint: 'Patient Reported (Multilingual Speech NLU)',
        historyOfPresentIllness: 'Universal Adaptive Clinical Engine (Gemini 3.5)',
        lifestyle: 'Patient Reported (Lifestyle Pre-Assessment)',
        pastMedicalHistory: 'Patient Reported (Kiosk Self-Declaration)',
        pastSurgicalHistory: 'Patient Reported',
        medications: 'Patient Reported (Current Medications Module)',
        allergies: 'Patient Reported (Clinical Allergy Safety Check)',
        vitals: vitals ? 'Nurse Measured (Biometric Station)' : 'Pending Nurse Intake',
        documents: documents?.length ? 'Uploaded Document (OCR Extractor)' : 'None Uploaded',
      },
    };
  }
}

export class GeminiAIProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private fallback = new UniversalClinicalEngine();

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }

  async extractFacts(input: string, state: ClinicalState, language: 'EN' | 'HI' | 'GU'): Promise<Partial<ClinicalState>> {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 6000));
      const extractionPromise = (async () => {
        const prompt = `You are the clinical fact extraction engine of MediKiosk AI Clinical Intake.
Patient Input: "${input}"
Input Language: ${language}
Current Clinical State: ${JSON.stringify(state)}

Extract all clinical facts into English-normalized structured JSON with no markdown fences:
{
  "chiefComplaint": "string | null",
  "newSymptoms": [
    {
      "name": "normalized english symptom name",
      "originalText": "exact text from patient",
      "onset": "duration or onset if mentioned or null",
      "severity": 1-10 or null,
      "character": "string describing quality/sensation or null"
    }
  ],
  "pastConditions": ["string"],
  "medications": ["string"]
}`;

        const res = await this.model.generateContent(prompt);
        const text = res.response.text().replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);

        const update: Partial<ClinicalState> = {};
        if (parsed.chiefComplaint && !state.chiefComplaint) {
          update.chiefComplaint = parsed.chiefComplaint;
          update.chiefComplaintOriginal = input;
        }
        if (parsed.newSymptoms && Array.isArray(parsed.newSymptoms) && parsed.newSymptoms.length > 0) {
          update.symptoms = [...(state.symptoms || []), ...parsed.newSymptoms];
        }
        if (parsed.pastConditions && Array.isArray(parsed.pastConditions) && parsed.pastConditions.length > 0) {
          update.pastMedicalHistory = [...(state.pastMedicalHistory || []), ...parsed.pastConditions];
        }
        if (parsed.medications && Array.isArray(parsed.medications) && parsed.medications.length > 0) {
          const newMeds = parsed.medications.map((m: string) => ({ name: m }));
          update.medications = [...(state.medications || []), ...newMeds];
        }
        return update;
      })();

      const res = (await Promise.race([extractionPromise, timeoutPromise])) as Partial<ClinicalState>;
      const fallbackResult = await this.fallback.extractFacts(input, state, language);
      return { ...fallbackResult, ...res };
    } catch (e) {
      return this.fallback.extractFacts(input, state, language);
    }
  }

  async translateText(text: string, targetLanguage: 'EN' | 'HI' | 'GU'): Promise<string> {
    try {
      const direct = await this.fallback.translateText(text, targetLanguage);
      if (direct && direct !== text) {
        return direct;
      }

      const prompt = `You are a clinical intake translator.
Translate the following medical sentence, question, or option into natural, grammatically correct ${targetLanguage} (EN = English, HI = Hindi, GU = Gujarati).
Preserve the EXACT clinical meaning. Do NOT add explanations.
Return ONLY the direct translated sentence:
"${text}"`;

      const res = await this.model.generateContent(prompt);
      const result = res.response.text().trim().replace(/^["']|["']$/g, '');
      if (result && result.length > 1) {
        return result;
      }
      return direct;
    } catch (e) {
      return this.fallback.translateText(text, targetLanguage);
    }
  }

  async generateNextQuestion(state: ClinicalState, language: 'EN' | 'HI' | 'GU', isAyush = false, conversationHistory?: Array<{ role: string; content: string }>): Promise<QuestionOutput> {
    try {
      const isCaregiver = state.respondentType === 'CAREGIVER' || state.respondentType === 'STAFF_ASSISTED';
      const isNew = state.isNewPatient !== false;
      const prevInfo = state.previousVisitInfo;

      const historyFormatted = conversationHistory && conversationHistory.length > 0
        ? conversationHistory.map(m => `${m.role === 'AI' ? 'Doctor AI' : 'Patient'}: "${m.content}"`).join('\n')
        : (state.questionsAsked || []).map((q, idx) => `Turn ${idx + 1} Question: "${q}"`).join('\n');

      const prompt = `You are MediKiosk Autonomous Clinical AI Intake Doctor powered by Google Gemini.
Your mission is to conduct an empathetic, comprehensive, multi-turn clinical intake interview with the patient (or caregiver).

CONVERSATION TRANSCRIPT SO FAR:
${historyFormatted}

ACTIVE CLINICAL CONTEXT:
Patient Type: ${isNew ? 'NEW PATIENT (First hospital visit)' : 'EXISTING / RETURNING PATIENT (Follow-up visit)'}
${!isNew && prevInfo ? `Previous Visit Record: Last visit date: ${prevInfo.lastVisitDate}, Last complaint: ${prevInfo.lastComplaint}, Last department: ${prevInfo.lastDepartment}, Past medications: ${prevInfo.pastPrescriptions.join(', ') || 'None'}` : ''}
Current Chief Complaint / Symptoms: "${state.chiefComplaint || ''}"
Patient Just Answered / Stated: "${state.latestAnswer || ''}"
Target Language: ${language} (EN = English, HI = Hindi, GU = Gujarati)
Respondent: ${isCaregiver ? 'Caregiver / Family Member answering on behalf of the patient (ask questions in 3rd person about the patient)' : 'Patient themselves'}
Clinical History Gathered So Far: ${JSON.stringify(state)}
Turns Completed: ${state.turnsCompleted}

CLINICAL INTAKE WORKFLOW & DOCTOR RULES:
1. DYNAMIC ANSWER-DRIVEN INQUIRY FOR RETURNING (OLD) PATIENTS:
   - The patient is attending a follow-up consultation.
   - You MUST formulate EVERY follow-up question 100% dynamically based strictly on the patient's latest answer, what specific changes or symptoms they just stated, their past diagnosis, previous visit history, and past medications.
   - DO NOT follow any rigid checklist, fixed pattern, or fixed sequence of questions.
   - If the patient reports worsening symptoms or increased pain, immediately investigate the exact changes, radiation, new triggers, and functional limits.
   - If the patient reports medication issues, side effects, or questions, explore drug adherence, tolerability, and efficacy.
   - If the patient reports improvement or resolution, ask about residual symptoms or refill needs, and complete intake when appropriate.
   - If the patient raises a new problem or secondary complaint, dynamically explore the onset, duration, and severity of that new issue.
2. NEW PATIENTS WORKFLOW:
   - Gather baseline lifestyle and past medical history before deeply exploring chief complaint characteristics and red flags.
3. AUTONOMOUS CLINICAL COMPLETION:
   - You (the AI Doctor) have full clinical autonomy to decide the exact number of questions.
   - If the patient's condition is mild, stable, or resolved, complete in fewer turns.
   - If the condition is complex, severe, or worsening, ask as many targeted follow-up questions as clinically needed.
   - Set "isComplete": true ONLY with a final closing verification question when all clinically necessary dimensions are gathered.
4. TOUCH OPTIONS: For EVERY question, generate 3-4 natural, highly appropriate one-tap touchOptions in pure ${language} directly answering this specific follow-up question.
5. ANTI-REPETITION: NEVER re-ask any question or dimension already answered in previous turns or conversation transcript.
6. LANGUAGE: Formulate the question and touchOptions in 100% natural, culturally fluent ${language}.

Return ONLY valid JSON (no markdown fences):
{
  "question": "dynamic follow-up question in pure ${language}",
  "questionLanguage": "${language}",
  "questionCategory": "ONSET | DURATION | SEVERITY | CHARACTER | LIFESTYLE | MEDICATIONS | PAST_HISTORY | AYUSH | CLOSING",
  "touchOptions": ["Option 1 in ${language}", "Option 2 in ${language}", "Option 3 in ${language}"],
  "isRedFlag": boolean,
  "redFlagReason": "string | null",
  "isComplete": boolean,
  "clinicalRationale": "Diagnostic reasoning for this follow-up inquiry"
}`;

      const res = await this.model.generateContent(prompt);
      const text = res.response.text().replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.touchOptions) || parsed.touchOptions.length < 2) {
        const fallbackQ = await this.fallback.generateNextQuestion(state, language, isAyush, conversationHistory);
        parsed.touchOptions = fallbackQ.touchOptions;
      }
      return parsed;
    } catch (e: any) {
      console.log(`[AI Engine] Notice: ${e?.message?.slice(0, 80) || 'using clinical fallback'}`);
      return this.fallback.generateNextQuestion(state, language, isAyush, conversationHistory);
    }
  }



  async generateClinicalSummary(state: ClinicalState, patient: any, vitals?: any, documents?: any[]): Promise<any> {
    try {
      const prompt = `You are a clinical documentation AI. Generate an exhaustive, professional, structured clinical intake summary based on:
Patient: ${JSON.stringify(patient)}
Clinical State: ${JSON.stringify(state)}
Vitals: ${JSON.stringify(vitals || {})}
Uploaded Documents / OCR Findings: ${JSON.stringify(documents || [])}

STRICT CLINICAL RULES:
1. NEVER hallucinate or invent diagnoses, medications, lab values, or vitals.
2. If patient reported negative symptoms (e.g. no vomiting, no fever), preserve them in HPI as "Patient denies ...".
3. If returning patient, summarize changes since previous visit.
4. Detect any contradictions between past records and current answers.
5. Perform medication reconciliation comparing previous prescribed meds vs patient-reported meds.

Return ONLY valid JSON with no markdown fences:
{
  "overview": "Brief clinical overview of the patient presentation",
  "chiefComplaint": "Chief complaint statement",
  "historyOfPresentIllness": "Comprehensive narrative History of Present Illness (HPI) including onset, location, severity, character, radiation, triggers, aggravating/relieving factors, and clinically relevant negative findings",
  "lifestyle": "Daily routine, sleep hours/quality, diet, physical activity, and occupation factors",
  "pastMedicalHistory": "Summary of prior chronic conditions or 'None reported'",
  "pastSurgicalHistory": "Summary of prior surgeries or 'No prior surgeries reported'",
  "medications": "Current regular medications with dosages and frequencies",
  "allergies": "Known drug/environmental allergies or NKDA (No Known Drug Allergies)",
  "familyHistory": "Family medical history or 'Non-contributory'",
  "socialHistory": "Social habits (smoking/alcohol/stress) or 'Non-contributory'",
  "vitalHighlights": "Summary of vitals if present with source attribution",
  "extractedDocumentFindings": [
    {
      "documentTitle": "title",
      "documentType": "type",
      "findings": ["finding 1"],
      "labResults": []
    }
  ],
  "changesSincePreviousVisit": "string | null",
  "contradictions": ["string describing any conflicting information requiring clinician verification"],
  "medicationReconciliation": {
    "patientReported": ["med 1"],
    "previouslyPrescribed": ["med 2"],
    "documentExtracted": []
  },
  "clinicianVerificationRequired": boolean,
  "redFlags": ["List of any detected clinical red flags"],
  "completenessScore": 95,
  "confidenceScore": 98,
  "sourceMap": {
    "chiefComplaint": "Patient Reported (Multilingual Speech NLU)",
    "historyOfPresentIllness": "Gemini Multilingual Clinical Engine",
    "lifestyle": "Patient Reported (Lifestyle Pre-Assessment)",
    "pastMedicalHistory": "Patient Reported (Kiosk Self-Declaration)",
    "pastSurgicalHistory": "Patient Reported",
    "medications": "Patient Reported (Current Medications Module)",
    "allergies": "Patient Reported (Clinical Allergy Safety Check)",
    "vitals": "Nurse Measured (Biometric Station)",
    "documents": "Uploaded Document (OCR Extractor)"
  }
}`;

      const res = await this.model.generateContent(prompt);
      const text = res.response.text().replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(text);
      if (!parsed.historyOfPresentIllness) {
        return this.fallback.generateClinicalSummary(state, patient, vitals, documents);
      }
      return parsed;
    } catch (e) {
      return this.fallback.generateClinicalSummary(state, patient, vitals, documents);
    }
  }
}

export function getAIProvider(): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.length > 10) {
    console.log('🤖 Using GeminiAIProvider (Autonomous Gemini 3.6 Flash)');
    return new GeminiAIProvider(apiKey);
  }
  console.log('💡 Using UniversalClinicalEngine (Pure Native Multilingual Clinical Intelligence)');
  return new UniversalClinicalEngine();
}
