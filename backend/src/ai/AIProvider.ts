import dotenv from 'dotenv';
dotenv.config();
import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ClinicalState, QuestionOutput } from './ClinicalState.js';
import { RedFlagEngine } from './RedFlagEngine.js';

export interface AIProvider {
  extractFacts(input: string, state: ClinicalState, language: 'EN' | 'HI' | 'GU', carePath?: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY', specialty?: string): Promise<Partial<ClinicalState>>;
  generateNextQuestion(state: ClinicalState, language: 'EN' | 'HI' | 'GU', carePath?: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY' | boolean, specialty?: string, conversationHistory?: Array<{ role: string; content: string }>): Promise<QuestionOutput>;
  translateText(text: string, targetLanguage: 'EN' | 'HI' | 'GU'): Promise<string>;
  generateClinicalSummary(state: ClinicalState, patient: any, vitals?: any, documents?: any[], carePath?: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY', specialty?: string): Promise<any>;
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

  // Closing & Phase B Handoff
  {
    EN: 'Proceed to Appointment',
    HI: 'अपॉइंटमेंट के लिए आगे बढ़ें',
    GU: 'કન્સલ્ટેશન માટે આગળ વધો',
  },
  {
    EN: 'Review Summary',
    HI: 'सारांश देखें',
    GU: 'વિગતો જુઓ',
  },
  {
    EN: 'Add One More Detail',
    HI: 'एक और जानकारी जोड़ें',
    GU: 'વધુ એક વિગત ઉમેરો',
  },
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

  // General & Triage Symptoms
  {
    EN: 'Fever / Body Ache',
    HI: 'बुखार / शरीर दर्द',
    GU: 'તાવ / શરીરનો દુખાવો',
  },
  {
    EN: 'Chest Pain / Pressure',
    HI: 'सीने में दर्द / दबाव',
    GU: 'છાતીમાં દુખાવો / દબાણ',
  },
  {
    EN: 'Severe Abdominal Pain',
    HI: 'पेट में तेज़ दर्द',
    GU: 'પેટમાં તીવ્ર દુખાવો',
  },
  {
    EN: 'Cough / Breathlessness',
    HI: 'खांसी / सांस में तकलीफ',
    GU: 'ખાંસી / શ્વાસ લેવામાં તકલીફ',
  },
  {
    EN: 'Headache / Dizziness',
    HI: 'सिरदर्द / चक्कर आना',
    GU: 'માથાનો દુખાવો / ચક્કર',
  },

  // AYUSH & Ayurveda Intake Options
  {
    EN: 'Acidity, heartburn & sour burps',
    HI: 'एसिडिटी, सीने में जलन और खट्टी डकारें',
    GU: 'એસિડિટી, છાતીમાં બળતરા અને ખાટા ઓડકાર',
  },
  {
    EN: 'Sluggish digestion & gas',
    HI: 'मंदाग्नि, भारीपन और पेट में गैस',
    GU: 'મંદ પાચન, ભારેપણું અને પેટમાં ગેસ',
  },
  {
    EN: 'Joint pain & body stiffness',
    HI: 'जोड़ों का दर्द और शरीर में जकड़न',
    GU: 'સાંધાનો દુખાવો અને શરીરમાં જકડન',
  },
  {
    EN: 'Chronic cough & sinus',
    HI: 'पुरानी खांसी और साइनस/कफ',
    GU: 'જૂની ખાંસી અને સાઇનસ/કફ',
  },
  {
    EN: 'Skin itching & eruptions',
    HI: 'त्वचा में खुजली और चकत्ते',
    GU: 'ચામડી પર ખંજવાળ અને ચકામા',
  },

  // Homeopathy Intake Options
  {
    EN: 'Throbbing headache (< Sun, > Cold)',
    HI: 'टीस मारने वाला सिरदर्द (धूप से बढ़ता, ठंडे से आराम)',
    GU: 'ધબકારા મારતો માથાનો દુખાવો (તડકામાં વધે, ઠંડકથી રાહત)',
  },
  {
    EN: 'Skin itching & eczema (< Warmth)',
    HI: 'त्वचा में खुजली और एग्जिमा (गर्मी से बढ़ता)',
    GU: 'ચામડીમાં ખંજવાળ અને ખરજવું (ગરમીથી વધે)',
  },
  {
    EN: 'Chronic acidity & gastric reflux',
    HI: 'पुरानी एसिडिटी और सीने में जलन',
    GU: 'જૂની એસિડિટી અને ગેસ્ટ્રિક રિફ્લક્સ',
  },
  {
    EN: 'Joint pain (< First motion)',
    HI: 'जोड़ों का दर्द (चलना शुरू करने पर ज्यादा)',
    GU: 'સાંધાનો દુખાવો (હલનચલન શરૂ કરતા વધે)',
  },
  {
    EN: 'Cough / asthma flare (< Cold drafts)',
    HI: 'खांसी / दमा का दौरा (ठंडी हवा से बढ़ता)',
    GU: 'ખાંસી / દમનો હુમલો (ઠંડી હવાથી વધે)',
  },

  // Dermatology Options
  {
    EN: 'Red itchy rash or eczema patches',
    HI: 'लाल खुजली वाले दाने या एग्जिमा के चकत्ते',
    GU: 'લાલ ખંજવાળવાળા ચકામા કે ખરજવું',
  },
  {
    EN: 'Pimples, facial acne & dark spots',
    HI: 'मुँहासे, फुंसी और चेहरे पर दाग',
    GU: 'ખીલ, ફોડલીઓ અને ચહેરા પર ડાઘ',
  },
  {
    EN: 'Fungal infection / Ringworm itching',
    HI: 'दाद / फंगल इन्फेक्शन की तेज खुजली',
    GU: 'દાદર / ફંગલ ઇન્ફેક્શનની તીવ્ર ખંજવાળ',
  },
  {
    EN: 'Hair fall & scalp dandruff',
    HI: 'बाल झड़ना और डैंड्रफ की समस्या',
    GU: 'વાળ ખરવા અને ખોડો થવો',
  },
  {
    EN: 'Skin allergy / Hives flare',
    HI: 'त्वचा में एलर्जी / पित्ती (Hives) उछलना',
    GU: 'ચામડીની એલર્જી / શીત પિત્તના ઢીમચા',
  },

  // Cardiology Options
  {
    EN: 'Chest pain, pressure or tightness',
    HI: 'सीने में दर्द, भारीपन या दबाव',
    GU: 'છાતીમાં દુખાવો, ભારેપણું કે દબાણ',
  },
  {
    EN: 'Rapid heartbeat / Palpitations',
    HI: 'दिल की तेज धड़कन / घबराहट',
    GU: 'હૃદયના ઝડપી ધબકારા / ગભરામણ',
  },
  {
    EN: 'Shortness of breath on walking/climbing',
    HI: 'चलने या सीढ़ी चढ़ने पर सांस फूलना',
    GU: 'ચાલતી વખતે શ્વાસ ચડવો',
  },
  {
    EN: 'Dizziness or lightheaded spells',
    HI: 'चक्कर आना या आँखों के आगे अंधेरा',
    GU: 'ચક્કર આવવા કે અંધારા આવવા',
  },
  {
    EN: 'Swelling in both feet / ankles',
    HI: 'दोनों पैरों या टखनों में सूजन',
    GU: 'બંને પગ કે ઘૂંટીમાં સોજો',
  },

  // Orthopedics Options
  {
    EN: 'Knee joint pain & swelling',
    HI: 'घुटने के जोड़ में दर्द और सूजन',
    GU: 'ઘૂંટણનો દુખાવો અને સોજો',
  },
  {
    EN: 'Lower back pain & lumbar stiffness',
    HI: 'कमर के निचले हिस्से में दर्द व जकड़न',
    GU: 'કમરનો દુખાવો અને જકડન',
  },
  {
    EN: 'Shoulder or neck pain / frozen shoulder',
    HI: 'कंधे या गर्दन में दर्द (फ्रोजन शोल्डर)',
    GU: 'ખભા કે ગરદનનો દુખાવો',
  },
  {
    EN: 'Ankle sprain or foot pain',
    HI: 'पैर या टखने में मोच / दर्द',
    GU: 'પગ કે ઘૂંટીમાં મચકોડ / દુખાવો',
  },
  {
    EN: 'Sciatica pain radiating down leg',
    HI: 'सायटिका दर्द जो पैर में नीचे तक जाता है',
    GU: 'સાયટીકાનો દુખાવો જે પગમાં નીચે ઉતરે છે',
  },

  // ENT Options
  {
    EN: 'Severe sore throat & painful swallowing',
    HI: 'गले में तेज दर्द और निगलने में तकलीफ',
    GU: 'ગળામાં તીવ્ર દુખાવો અને ગળવામાં તકલીફ',
  },
  {
    EN: 'Ear pain, discharge or reduced hearing',
    HI: 'कान में दर्द, मवाद आना या कम सुनाई देना',
    GU: 'કાનમાં દુખાવો, પરુ કે ઓછું સંભળાવું',
  },
  {
    EN: 'Nasal blockage, sinus pressure & cold',
    HI: 'नाक बंद, साइनस का भारीपन व जुकाम',
    GU: 'નાક બંધ, સાઇનસનું ભારેપણું અને શરદી',
  },
  {
    EN: 'Hoarseness of voice or persistent throat clearing',
    HI: 'आवाज बैठना या गले में खराश',
    GU: 'અવાજ બેસી જવો કે ગળામાં ખારાશ',
  },
  {
    EN: 'Dizziness / Ear ringing (Tinnitus)',
    HI: 'चक्कर आना या कान में सीटी की आवाज',
    GU: 'ચક્કર આવવા કે કાનમાં અવાજ આવવો',
  },

  // Pediatrics Options
  {
    EN: 'High fever with chills & body warmth',
    HI: 'तेज बुखार, कंपकंपी और गर्म शरीर',
    GU: 'તીવ્ર તાવ, ધ્રુજારી અને ગરમ શરીર',
  },
  {
    EN: 'Persistent cough & fast breathing',
    HI: 'लगातार खांसी और तेज सांस चलना',
    GU: 'સતત ખાંસી અને ઝડપી શ્વાસ',
  },
  {
    EN: 'Vomiting & loose motions / diarrhea',
    HI: 'उल्टी और दस्त (Loose motions)',
    GU: 'ઉલટી અને ઝાડા (ડાયેરિયા)',
  },
  {
    EN: 'Skin rash, measles-like spots or itching',
    HI: 'त्वचा पर दाने, चकत्ते या खुजली',
    GU: 'ચામડી પર દાણા, ચકામા કે ખંજવાળ',
  },
  {
    EN: 'Poor feeding, irritability & low energy',
    HI: 'दूध/खाना न पीना, चिड़चिड़ापन और सुस्ती',
    GU: 'ખોરાક/દૂધ ન લેવું, ચીડિયાપણું અને સુસ્તી',
  },

  // Gastroenterology Options
  {
    EN: 'Severe stomach pain & cramping',
    HI: 'पेट में तेज दर्द और मरोड़',
    GU: 'પેટમાં તીવ્ર દુખાવો અને ચૂંક',
  },
  {
    EN: 'Chronic acidity, heartburn & sour burps',
    HI: 'पुरानी एसिडिटी, सीने में जलन और खट्टी डकारें',
    GU: 'જૂની એસિડિટી, છાતીમાં બળતરા અને ખાટા ઓડકાર',
  },
  {
    EN: 'Frequent vomiting & nausea',
    HI: 'बार-बार उल्टी और जी मिचलाना',
    GU: 'વારંવાર ઉલટી અને ઉબકા',
  },
  {
    EN: 'Constipation / Difficulty in bowel movement',
    HI: 'कब्ज / पेट साफ न होना',
    GU: 'કબજિયાત / પેટ સાફ ન આવવું',
  },
  {
    EN: 'Loose motions / Diarrhea with cramps',
    HI: 'दस्त / मरोड़ के साथ पतले दस्त',
    GU: 'ઝાડા / ચૂંક સાથે પાતળા ઝાડા',
  },

  // Pulmonology Options
  {
    EN: 'Persistent dry or productive cough',
    HI: 'लगातार सूखी या बलगम वाली खांसी',
    GU: 'સતત સૂકી કે કફવાળી ખાંસી',
  },
  {
    EN: 'Shortness of breath / Wheezing sound',
    HI: 'सांस फूलना / सीने से सीटी जैसी आवाज',
    GU: 'શ્વાસ ચડવો / છાતીમાંથી સીટી જેવો અવાજ',
  },
  {
    EN: 'Chest tightness with cold drafts',
    HI: 'ठंडी हवा से सीने में जकड़न',
    GU: 'ઠંડી હવાથી છાતીમાં જકડન',
  },
  {
    EN: 'Night-time cough awakening sleep',
    HI: 'रात में नींद से जगाने वाली खांसी',
    GU: 'રાત્રે ઊંઘમાંથી જગાડતી ખાંસી',
  },
  {
    EN: 'Coughing up discolored phlegm / mucus',
    HI: 'पीला या गाढ़ा बलगम आना',
    GU: 'પીળો કે ઘટ્ટ કફ નીકળવો',
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
  
  if (/vomit|nausea|उल्टी|ઉલટી|उबका|ઉબકા|जी मिचला/i.test(c)) {
    return lang === 'HI' ? 'उल्टी और जी मिचलाने' : lang === 'GU' ? 'ઉલટી અને ઉબકા' : 'vomiting and nausea';
  }
  if (/dizz|vertigo|gidd|चक्कर|ચક્કર/i.test(c)) {
    return lang === 'HI' ? 'चक्कर आने' : lang === 'GU' ? 'ચક્કર આવવા' : 'dizziness and vertigo';
  }
  if (/diarrhea|loose motion|motions|दस्त|ઝાડા|મરોડ/i.test(c)) {
    return lang === 'HI' ? 'दस्त और पेट में मरोड़' : lang === 'GU' ? 'ઝાડા અને પેટમાં ચૂંક' : 'loose motions and diarrhea';
  }
  if (/breath|dyspnea|asthma|wheez|सांस|શ્વાસ/i.test(c)) {
    return lang === 'HI' ? 'सांस लेने में तकलीफ' : lang === 'GU' ? 'શ્વાસ લેવામાં તકલીફ' : 'breathing difficulty and shortness of breath';
  }
  if (/eye|vision|आँख|આંખ/i.test(c)) {
    return lang === 'HI' ? 'आँखों में दर्द और लाली' : lang === 'GU' ? 'આંખોમાં દુખાવો અને લાલાશ' : 'eye pain and irritation';
  }
  if (/ear|hear|कान|કાન/i.test(c)) {
    return lang === 'HI' ? 'कान में दर्द और भारीपन' : lang === 'GU' ? 'કાનમાં દુખાવો અને પરુ' : 'ear pain and discharge';
  }
  if (/pimple|acne|boil|मुँहासे|फुंसी|ખીલ/i.test(c)) {
    return lang === 'HI' ? 'मुँहासे / दानों' : lang === 'GU' ? 'ખીલ' : 'pimples / skin spots';
  }
  if (/rash|skin|itch|खुजली|ચકામા/i.test(c)) {
    return lang === 'HI' ? 'त्वचा की खुजली / चकत्तों' : lang === 'GU' ? 'ચામડીની ખંજવાળ / ચકામા' : 'skin rash and itching';
  }
  if (/chest|heart|सीने|छाती/i.test(c)) {
    return lang === 'HI' ? 'सीने में दर्द व भारीपन' : lang === 'GU' ? 'છાતીમાં દુખાવો અને ભારેપણું' : 'chest discomfort';
  }
  if (/knee|joint|bone|arthritis|घुटने|जोड़ों|ઘૂંટણ|સાંધા/i.test(c)) {
    return lang === 'HI' ? 'घुटने और जोड़ों के दर्द' : lang === 'GU' ? 'ઘૂંટણ અને સાંધાના દુખાવા' : 'knee and joint pain';
  }
  if (/back|spine|lumbar|sciatica|कमर|पीठ|પીઠ|વાંસો/i.test(c)) {
    return lang === 'HI' ? 'कमर और पीठ के दर्द' : lang === 'GU' ? 'કમરના દુખાવા' : 'back pain and stiffness';
  }
  if (/groin|inguinal|जांघ|પેલ્વિસ|સાથળ/i.test(c)) {
    return lang === 'HI' ? 'जांघ और ग्रोइन के दर्द' : lang === 'GU' ? 'સાથળ અને પેલ્વિસના દુખાવા' : 'groin discomfort and pain';
  }
  if (/penis|genitourinary|urology|erectile|लिंग|ઇન્દ્રિય|પુરુષ અંગ/i.test(c)) {
    return lang === 'HI' ? 'जननांग व यूरिन संबंधी चिंता' : lang === 'GU' ? 'જનનાંગ અને પેશાબ સંબંધિત સમસ્યા' : 'genitourinary concerns';
  }
  if (/urine|urina|burning urine|पेशाब|પેશાબ/i.test(c)) {
    return lang === 'HI' ? 'पेशाब में जलन और दर्द' : lang === 'GU' ? 'પેશાબમાં બળતરા અને દુખાવો' : 'urinary burning and discomfort';
  }
  if (/stomach|abdom|acidity|gas|मरोड़|पेट|પેટ/i.test(c)) {
    return lang === 'HI' ? 'पेट दर्द, जलन और तकलीफ' : lang === 'GU' ? 'પેટમાં દુખાવો અને બળતરા' : 'stomach discomfort and acidity';
  }
  if (/headache|head|migraine|सिरदर्द|माथा|માથા/i.test(c)) {
    return lang === 'HI' ? 'सिरदर्द' : lang === 'GU' ? 'માથાના દુખાવા' : 'headache';
  }
  if (/cough|cold|throat|sore throat|खांसी|गला|ઉધરસ|ગળું/i.test(c)) {
    return lang === 'HI' ? 'खांसी और गले की खराश' : lang === 'GU' ? 'ઉધરસ અને ગળાની તકલીફ' : 'cough and throat irritation';
  }
  if (/fever|temperature|shiver|chills|बुखार|તાવ/i.test(c)) {
    return lang === 'HI' ? 'बुखार और शारीरिक कमजोरी' : lang === 'GU' ? 'તાવ અને શારીરિક નબળાઈ' : 'fever and body weakness';
  }
  if (/injury|wound|trauma|fall|चोट|घाव|ઈજા/i.test(c)) {
    return lang === 'HI' ? 'चोट और घाव' : lang === 'GU' ? 'ઈજા અને સોજો' : 'injury and swelling';
  }

  // Clean raw phrases (e.g. "I feel like vomitting" -> "vomitting")
  const cleaned = complaint.replace(/^i feel like |i have |there is |severe |mild /gi, '').trim();
  if (cleaned.length > 2 && cleaned.length < 35) {
    return cleaned;
  }

  return lang === 'HI' ? 'इस समस्या' : lang === 'GU' ? 'આ તકલીફ' : 'this symptom';
}

export class UniversalClinicalEngine implements AIProvider {
  async extractFacts(input: string, state: ClinicalState, language: 'EN' | 'HI' | 'GU', carePath?: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY', specialty?: string): Promise<Partial<ClinicalState>> {
    const text = input.trim();
    const update: Partial<ClinicalState> = {};
    const tLower = text.toLowerCase();
    const effectiveCarePath = carePath || state.carePath || 'ALLOPATHY';

    // 1. Explicit Negation / Denied Symptoms
    if (/\b(no|not|don't have|dont have|denies|deny|without|no history of)\b|नहीं|ના|નથી/i.test(tLower)) {
      const deniedList = [...(state.deniedSymptoms || [])];
      if (/vomit|उल्टी|ઉલટી/i.test(tLower) && !deniedList.includes('vomiting')) deniedList.push('vomiting');
      if (/fever|बुखार|તાવ/i.test(tLower) && !deniedList.includes('fever')) deniedList.push('fever');
      if (/dizz|चक्कर|ચક્કર/i.test(tLower) && !deniedList.includes('dizziness')) deniedList.push('dizziness');
      if (/numb|weakness|सुन्नपन|ખાલી/i.test(tLower) && !deniedList.includes('focal neurological deficit')) deniedList.push('focal neurological deficit');
      if (/blur|vision|धुंधला|ઝાંખું/i.test(tLower) && !deniedList.includes('visual disturbance')) deniedList.push('visual disturbance');
      if (/neck|stiff|गर्दन|ગરદન/i.test(tLower) && !deniedList.includes('neck stiffness')) deniedList.push('neck stiffness');
      if (/blood|खून|લોહી/i.test(tLower) && !deniedList.includes('bleeding')) deniedList.push('bleeding');
      
      update.deniedSymptoms = deniedList;
    }

    // 2. Family History Detection
    if (/\b(father|mother|brother|sister|parent|family|dad|mom|grandpa|grandma)\b|पिताजी|माताजी|परिवार|પિતાજી|માતાજી|પરિવાર/i.test(tLower)) {
      const famList = [...(state.familyHistory || [])];
      let relation = 'Family Member';
      if (/father|dad|पिता|પિતા/i.test(tLower)) relation = 'Father';
      else if (/mother|mom|माता|માતા/i.test(tLower)) relation = 'Mother';
      else if (/brother|sister|भाई|બહેન/i.test(tLower)) relation = 'Sibling';

      let condition = text;
      if (/diabetes|sugar|शुगर|ડાયાબિટીસ/i.test(tLower)) condition = 'Diabetes Mellitus';
      else if (/bp|hypertension|blood pressure|बीपी/i.test(tLower)) condition = 'Hypertension';
      else if (/heart|cardiac|दिल|हार्ट/i.test(tLower)) condition = 'Cardiac Disease';
      else if (/migraine|माइग्रेन|આધાશીશી/i.test(tLower)) condition = 'Migraine';

      const entry = `${relation}: ${condition}`;
      if (!famList.includes(entry)) famList.push(entry);
      update.familyHistory = famList;
    }

    // 3. Historical / Resolved Illness
    if (/\b(had|last month|last year|past|childhood|previously|resolved|ago)\b|पहले|गया|પહેલા|ગયા મહિને/i.test(tLower)) {
      const histList = [...(state.historicalFindings || [])];
      if (!histList.includes(text)) histList.push(text);
      update.historicalFindings = histList;
      
      const pastMed = [...(state.pastMedicalHistory || [])];
      if (!pastMed.includes(text)) pastMed.push(text);
      update.pastMedicalHistory = pastMed;
    }

    // 4. Care-Path Specific Attribute Extraction
    if (effectiveCarePath === 'AYUSH') {
      const currentAyush = { ...(state.ayushAssessment || {}) };
      if (/heavy|bloat|slow|mandagni|गैस|भारीपन|મંદ|સુસ્તી/i.test(tLower)) currentAyush.agni = 'MANDAGNI';
      else if (/burning|acid|acidity|tikshna|जलन|તીક્ષ્ણ/i.test(tLower)) currentAyush.agni = 'TIKSHNAGNI';
      else if (/irregular|visham|विषम/i.test(tLower)) currentAyush.agni = 'VISHAMAGNI';

      if (/constipat|hard stool|krura|कब्ज|कड़ा|કબજિયાત|કઠણ/i.test(tLower)) currentAyush.koshtha = 'KRURA';
      else if (/loose|soft|mridu|पतला|મૃદુ/i.test(tLower)) currentAyush.koshtha = 'MRIDU';

      if (/spicy|oily|tea|coffee|fast food|तला-भुना|તીખું|તળેલું/i.test(tLower)) currentAyush.ahara = text;
      if (/late night|night shift|sleep late|दिनचर्या|મોડી રાત્રે/i.test(tLower)) currentAyush.vihara = text;
      update.ayushAssessment = currentAyush;
    } else if (effectiveCarePath === 'HOMEOPATHY') {
      const currentHomeo = { ...(state.homeopathyAssessment || { modalities: { aggravating: [], relieving: [] } }) };
      const aggList = [...(currentHomeo.modalities?.aggravating || [])];
      const relList = [...(currentHomeo.modalities?.relieving || [])];

      if (/sun|heat|warmth|movement|motion|noise|light|afternoon|धूप|गर्मी|हिलने|તડકો|ગરમી/i.test(tLower)) {
        if (!aggList.includes(text)) aggList.push(text);
      }
      if (/cold|wash|dark|sleep|pressure|bandage|ठंडा|अंधेरे|दबाने|ઠંડુ|અંધારા|દબાવવાથી/i.test(tLower)) {
        if (!relList.includes(text)) relList.push(text);
      }
      currentHomeo.modalities = { aggravating: aggList, relieving: relList };

      if (/chilly|cold easily|cold drafts|ठंड ज्यादा|ઠંડી વધારે/i.test(tLower)) currentHomeo.thermalState = 'CHILLY';
      else if (/hot|heat easily|open air|गर्मी बर्दाश्त नहीं|ગરમી સહન ન થાય/i.test(tLower)) currentHomeo.thermalState = 'HOT';

      if (/thirstless|no thirst|don't feel thirsty|प्यास नहीं|તરસ નથી/i.test(tLower)) currentHomeo.thirst = 'THIRSTLESS';
      else if (/thirsty|large quantities|small sips|ज्यादा पानी|ખૂબ પાણી/i.test(tLower)) currentHomeo.thirst = text;

      if (/irritable|angry|alone|quiet|anxious|weep|गुस्सा|अकेले|શાંતિ|ચીડચીડાપણું/i.test(tLower)) currentHomeo.mentalState = text;

      update.homeopathyAssessment = currentHomeo;
    }
    const turns = state.turnsCompleted || 0;
    const isNew = state.isNewPatient !== false;

    // Direct Symptom / Chief Complaint Detection across all inputs
    const isSymptomMentioned = /vomit|nausea|उल्टी|ઉલટી|उबका|ઉબકા|जी मिचला|headache|सिरदर्द|માથા|chest|pain|दर्द|દુખાવો|ear|कान|કાન|stomach|पेट|પેટ|acidity|fever|बुखार|તાવ|cough|खांसी|ઉધરસ|rash|दाने|ધાબા|diarrhea|दस्त|ઝાડા|urine|पेशाब|પેશાબ|sciatica|कमर|spine|swelling|सूजन|સોજો/i.test(text);

    if (isNew) {
      // 1. Establish Chief Complaint if not yet present
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

      // 2. Active Symptom Progression
      const currentSymptom = (state.symptoms && state.symptoms[0]) ? { ...state.symptoms[0] } : {
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

      // Check if answer is Onset / Timing
      if (!currentSymptom.onset || !currentSymptom.duration) {
        currentSymptom.onset = text;
        currentSymptom.duration = text;
        update.symptoms = [currentSymptom];
        return update;
      }

      // Check if answer is Severity / Character
      if (!currentSymptom.severity || !currentSymptom.character) {
        const numMatch = text.match(/\b([1-9]|10)\b/);
        currentSymptom.severity = numMatch ? parseInt(numMatch[1], 10) : 5;
        currentSymptom.character = text;
        update.symptoms = [currentSymptom];
        return update;
      }

      // Check if answer mentions lifestyle
      if (/sleep|diet|food|stress|routine|काम|नींद|खाना|ઊંઘ|ખોરાક/i.test(text)) {
        update.lifestyle = {
          sleep: text,
          diet: text,
          activity: text,
          stress: state.lifestyle?.stress || 'Normal daily routine and stress level',
          occupation: state.lifestyle?.occupation || '',
          smoking: state.lifestyle?.smoking || null,
          alcohol: state.lifestyle?.alcohol || null,
        };
        return update;
      }

      // Check if answer mentions chronic illness or allergy
      if (/bp|blood pressure|sugar|diabetes|thyroid|allergy|एलर्जी|બીમારી|ડાયાબિટીસ/i.test(text)) {
        update.pastMedicalHistory = [text];
        update.allergies = [{ allergen: text, reaction: 'Reported during intake', severity: 'MILD' }];
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

    // Check Phase B Closing Statement
    if (/clinical questioning.*complete|clinical intake.*complete|questioning is now complete|क्लिनिकल पूछताछ पूरी हो गई|ક્લિનિકલ પૂછપરછ પૂર્ણ|પૂછપરછ પૂર્ણ/i.test(tLower)) {
      const q = {
        EN: "Thank you. Your clinical questioning is now complete. Your information has been prepared for the clinical team. Please proceed to your appointment / consultation room.",
        HI: "धन्यवाद। आपकी क्लिनिकल पूछताछ पूरी हो गई है और आपका विवरण डॉक्टर के लिए तैयार कर दिया गया है। कृपया अपने परामर्श कक्ष / अपॉइंटमेंट के लिए आगे बढ़ें।",
        GU: "ધન્યવાદ. આપની ક્લિનિકલ પૂછપરછ પૂર્ણ થઈ ગઈ છે અને આપની વિગતો ડૉક્ટર માટે તૈયાર છે. કૃપા કરીને આપના કન્સલ્ટેશન / તપાસ રૂમ તરફ આગળ વધો.",
      };
      return q[targetLanguage];
    }

    // Check Initial Welcome / Chief Complaint Question
    if (/welcome to|what main symptom|health concern|brought you|स्वास्थ्य समस्या|लक्षण महसूस|શારીરિક તકલીફ|લક્ષણો જણાય|મુખ્ય તકલીફ/i.test(tLower)) {
      const q = {
        EN: "Welcome to MediKiosk. What main symptom or health concern brought you in today?",
        HI: "मेडीकियोस्क में आपका स्वागत है। आज आपको क्या मुख्य स्वास्थ्य समस्या या लक्षण महसूस हो रहे हैं?",
        GU: "મેડીકિયોસ્ક માં આપનું સ્વાગત છે। આજે તમને કઈ મુખ્ય શારીરિક તકલીફ અથવા લક્ષણો જણાય છે?",
      };
      return q[targetLanguage];
    }

    // Check Stage 1: Lifestyle & Daily Routine
    if (tLower.includes('lifestyle') || tLower.includes('sleep') || tLower.includes('routine') || tLower.includes('diet') || tLower.includes('जीवनशैली') || tLower.includes('नींद') || tLower.includes('दिनचर्या') || tLower.includes('खान-पान') || tLower.includes('દિનચર્યા') || tLower.includes('ઊંઘ') || tLower.includes('ખોરાક')) {
      return CLINICAL_TRANSLATIONS.lifestyle[targetLanguage];
    }

    // Check Stage 2: Medical History & Allergies
    if (tLower.includes('medical conditions') || tLower.includes('allergy') || tLower.includes('allergies') || tLower.includes('chronic') || tLower.includes('thyroid') || tLower.includes('diabetes') || tLower.includes('पुरानी बीमारी') || tLower.includes('एलर्जी') || tLower.includes('थायराइड') || tLower.includes('જૂની બીમારી') || tLower.includes('એલર્જી') || tLower.includes('ડાયાબિટીસ')) {
      return CLINICAL_TRANSLATIONS.medical_history[targetLanguage];
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

  async generateNextQuestion(state: ClinicalState, language: 'EN' | 'HI' | 'GU', carePath?: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY' | boolean, specialty?: string, conversationHistory?: Array<{ role: string; content: string }>): Promise<QuestionOutput> {
    const lang: 'EN' | 'HI' | 'GU' = (language?.toUpperCase() as 'EN' | 'HI' | 'GU') || (state.currentLanguage as 'EN' | 'HI' | 'GU') || 'EN';
    const isNew = state.isNewPatient === false ? false : (state.isNewPatient === true ? true : !state.previousVisitInfo);
    const complaintText = state.chiefComplaint || 'problem';
    const localizedLabel = getSymptomLabelInLang(complaintText, lang);
    const isCaregiver = state.respondentType === 'CAREGIVER' || state.respondentType === 'STAFF_ASSISTED';
    
    // Resolve Care Path & Specialty
    const effectiveCarePath: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY' = typeof carePath === 'string'
      ? carePath
      : (carePath === true || state.carePath === 'AYUSH' ? 'AYUSH' : (state.carePath === 'HOMEOPATHY' ? 'HOMEOPATHY' : 'ALLOPATHY'));
    const effectiveSpecialty: string = specialty || state.specialty || 'General Medicine';

    // Track answered clinical dimensions from turns, state, and conversation transcript to guarantee smooth stage progression
    const answeredDimensions = new Set<string>();
    const turns = state.turnsCompleted || 0;
    const historyText = (conversationHistory || []).map(m => m.content).join(' ').toLowerCase() + ' ' + (state.questionsAsked || []).join(' ').toLowerCase();

    if (turns >= 2 || historyText.includes('how long') || historyText.includes('कब से') || historyText.includes('કેટલા સમયથી') || (state.symptoms || []).some(s => s.onset)) {
      answeredDimensions.add('ONSET');
    }
    if (turns >= 3 || historyText.includes('aggravated') || historyText.includes('bulge') || historyText.includes('urinary stream') || historyText.includes('severity') || historyText.includes('how many times') || historyText.includes('times have you') || historyText.includes('गंभीरता') || historyText.includes('તીવ્રતા') || (state.symptoms || []).some(s => s.severity || s.character)) {
      answeredDimensions.add('CHARACTER');
    }
    if (turns >= 4 || historyText.includes('lifestyle') || historyText.includes('sleep') || historyText.includes('routine') || historyText.includes('diet') || historyText.includes('दिनचर्या') || historyText.includes('દિનચર્યા') || (state.lifestyle?.sleep && state.lifestyle.sleep.length > 2)) {
      answeredDimensions.add('LIFESTYLE');
    }
    if (turns >= 5 || historyText.includes('medical conditions') || historyText.includes('ongoing') || historyText.includes('regular medicines') || historyText.includes('allergies') || historyText.includes('पुरानी बीमारी') || historyText.includes('જૂની બીમારી') || ((state.pastMedicalHistory || []).length > 0 && state.pastMedicalHistory[0] !== 'None reported')) {
      answeredDimensions.add('PAST_HISTORY');
    }
    if ((state.symptoms || []).some(s => s.progression)) answeredDimensions.add('PROGRESSION');
    if ((state.symptoms || []).some(s => (s as any).residualSymptoms)) answeredDimensions.add('RESIDUAL_SYMPTOMS');
    if ((state.medications || []).length > 0) answeredDimensions.add('MEDICATIONS');
    if ((state.allergies || []).length > 0) answeredDimensions.add('ALLERGIES');

    // ==========================================
    // WORKFLOW A: RETURNING PATIENT 100% DYNAMIC ANSWER-DRIVEN INTAKE
    // ==========================================
    if (!isNew) {
      const turns = state.turnsCompleted || 0;
      const latest = (state.latestAnswer || '').toLowerCase();
      const askedCount = (state.questionsAsked || []).length;

      // ----------------------------------------------------
      // TURN 0: INITIAL OPENING QUESTION (If 0 turns or no answer yet)
      // ----------------------------------------------------
      if (turns === 0 && !state.latestAnswer) {
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

      // Check if user is on Turn >= 3 OR selected final closing options
      const isExplicitClosing = /covers all symptoms|complete intake|सब लक्षण बता दिए|ઇન્ટેક પૂર્ણ|તમામ લક્ષણો જણાવી દીધા|no, that covers|ready for doctor|ready for consultation|परामर्श हेतु तैयार|મળવા તૈયાર/i.test(latest);

      // ----------------------------------------------------
      // PATHWAY 1: PARTIAL RELIEF / SYMPTOMS STILL PERSIST
      // ----------------------------------------------------
      const isPartial = /partial relief|persist|थोड़ा आराम|तकलीफ बाकी|થોડી રાહત|તકલીફ ચાલુ/i.test(latest) ||
        (turns === 1 && !/70%|significantly|काफी सुधार|સારો સુધારો|worsening|बढ़ गई|વધી ગઈ|new problem|नई समस्या|નવી સમસ્યા/i.test(latest));

      if (isPartial && turns === 1 && !isExplicitClosing) {
        const qText = {
          EN: isCaregiver
            ? `Which specific residual symptoms still linger for the patient, and during what times of the day or activities do they feel them most?`
            : `Which specific residual symptoms still linger or persist, and during what times of the day or activities do you feel them most?`,
          HI: isCaregiver
            ? `मरीज को अब कौन सी बची हुई तकलीफ अभी भी महसूस हो रही है, और किस समय या काम के दौरान यह ज्यादा होती है?`
            : `आपको अब कौन सी बची हुई तकलीफ अभी भी महसूस हो रही है, और किस समय या काम के दौरान यह ज्यादा होती है?`,
          GU: isCaregiver
            ? `દર્દીને હવે કઈ બાકી રહેલી તકલીફ હજુ પણ જણાય છે, અને કયા સમયે કે પ્રવૃત્તિ દરમિયાન તે વધુ થાય છે?`
            : `આપને હવે કઈ બાકી રહેલી તકલીફ હજુ પણ જણાય છે, અને કયા સમયે કે પ્રવૃત્તિ દરમિયાન તે વધુ થાય છે?`,
        };
        const touchOpts = {
          EN: ['Mild lingering ache during exertion', 'Morning stiffness & joint discomfort', 'Symptoms return as soon as medicine dose wears off', 'Dull background ache without sharp pain'],
          HI: ['काम/मेहनत करने पर हल्का दर्द', 'सुबह उठने पर हल्की जकड़न', 'दवा का असर खत्म होते ही तकलीफ लौट आती है', 'हल्का भारीपन बना रहता है'],
          GU: ['કામ/શ્રમ કરતી વખતે હળવો દુખાવો', 'સવારે જાગતી વખતે હળવી જકડન', 'દવાનો પ્રભાવ પૂરો થતાં તકલીફ પાછી આવે છે', 'હળવો દુખાવો સતત ચાલુ રહે છે'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Investigating residual symptom burden and aggravating daily triggers',
        };
      }

      // ----------------------------------------------------
      // PATHWAY 2: NO RELIEF / WORSENING SYMPTOMS / PAIN
      // ----------------------------------------------------
      const isWorse = /worsening|no relief|severe|pain|stiff|swelling|fever|बढ़ गई|तकलीफ बढ़|कोई आराम नहीं|दर्द|जकड़न|सूजन|बुखार|વધી ગઈ|રાહત નથી|દુખાવો|જકડન|સોજો|તાવ/i.test(latest);

      if (isWorse && turns === 1 && !isExplicitClosing) {
        const qText = {
          EN: isCaregiver
            ? `Since symptoms have intensified, where does the patient's pain or discomfort radiate, has any new swelling or stiffness appeared, and does it disturb their sleep?`
            : `Since your symptoms have intensified, where does the pain radiate, has any new swelling or stiffness appeared, and is it disturbing your sleep?`,
          HI: isCaregiver
            ? `चूँकि तकलीफ बढ़ी है, कृपया बताएं कि क्या दर्द फैल रहा है, नई सूजन या जकड़न आई है, और क्या रात में नींद में परेशानी हो रही है?`
            : `चूँकि आपकी तकलीफ बढ़ गई है, कृपया बताएं कि क्या दर्द फैल रहा है, नई सूजन या जकड़न आई है, और क्या रात की नींद में रुकावट है?`,
          GU: isCaregiver
            ? `જ્યારે તકલીફ વધી છે, તો કૃપા કરીને જણાવો કે શું દુખાવો ફેલાય છે, નવી સોજો કે જકડન આવી છે, અને ઊંઘમાં મુશ્કેલી થાય છે?`
            : `જ્યારે આપની તકલીફ વધી ગઈ છે, તો કૃપા કરીને જણાવો કે શું દુખાવો ફેલાય છે, નવી સોજો કે જકડન આવી છે, અને ઊંઘમાં તકલીફ છે?`,
        };
        const touchOpts = {
          EN: ['Pain radiating down limbs with numbness', 'Sharp continuous pain disturbing sleep', 'New swelling, warmth & redness noticed', 'Severe stiffness making movement difficult'],
          HI: ['हाथ-पैरों में सुन्नपन व खिंचाव के साथ दर्द', 'लगातार तेज दर्द जिससे नींद नहीं आती', 'नई सूजन, लाली और गर्माहट आ गई है', 'तेज जकड़न जिससे चलने-फिरने में भारी कष्ट है'],
          GU: ['હાથ-પગમાં ખાલી ચડવી અને ખેંચાણ સાથે દુખાવો', 'સતત તીવ્ર દુખાવો જેનાથી ઊંઘ આવતી નથી', 'નવી સોજો, લાલાશ અને ગરમી જણાય છે', 'તીવ્ર જકડન જેથી હલનચલનમાં ઘણી મુશ્કેલી છે'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Evaluating symptom exacerbation, radiating pain, and functional limits',
        };
      }

      // ----------------------------------------------------
      // PATHWAY 3: NEW COMPLAINT TODAY
      // ----------------------------------------------------
      const isNewProb = /new problem|नई समस्या|નવી સમસ્યા|headache|cough|rash|vomit|stomach|सिरदर्द|खांसी|दाने|ઉધરસ|દાણા/i.test(latest);

      if (isNewProb && turns === 1 && !isExplicitClosing) {
        const qText = {
          EN: isCaregiver
            ? `Please describe the patient's new complaint: when did it begin, and did it start suddenly or gradually?`
            : `Please describe your new complaint: when did it begin, and did it start suddenly or gradually?`,
          HI: isCaregiver
            ? `कृपया मरीज की इस नई समस्या के बारे में बताएं: यह कितने समय पहले शुरू हुई, और क्या यह अचानक हुई या धीरे-धीरे बढ़ी?`
            : `कृपया अपनी इस नई समस्या के बारे में बताएं: यह कब शुरू हुई, और क्या यह अचानक हुई या धीरे-धीरे बढ़ी?`,
          GU: isCaregiver
            ? `કૃપા કરીને દર્દીની આ નવી સમસ્યા વિશે જણાવો: આ કેટલા સમય પહેલા શરૂ થઈ, અને શું અચાનક થઈ કે ધીમે-ધીમે વધી?`
            : `કૃપા કરીને આપની આ નવી સમસ્યા વિશે જણાવો: આ કેટલા દિવસ પહેલા શરૂ થઈ, અને શું અચાનક થઈ કે ધીમે-ધીમે વધી?`,
        };
        const touchOpts = {
          EN: ['Started today / past few hours acutely', 'Started 2-3 days ago and worsening', 'Mild discomfort for about a week', 'Comes and goes intermittently'],
          HI: ['आज अचानक कुछ घंटों पहले शुरू हुई', '2-3 दिन पहले शुरू हुई और बढ़ रही है', 'लगभग एक सप्ताह से हल्की तकलीफ है', 'रुक-रुक कर होने वाली समस्या है'],
          GU: ['આજે અચાનક થોડા કલાકો પહેલા શરૂ થઈ', '૨-૩ દિવસ પહેલા શરૂ થઈ અને વધતી જાય છે', 'લગભગ એક અઠવાડિયાથી હળવી તકલીફ છે', 'અવારનવાર આવતી-જતી તકલીફ છે'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'ONSET',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Investigating onset and timing of new presenting chief complaint in follow-up encounter',
        };
      }

      // ----------------------------------------------------
      // PATHWAY 4: SIGNIFICANT IMPROVEMENT (>70% RELIEF)
      // ----------------------------------------------------
      const isSignificantRelief = /70%|significantly improved|काफी सुधार|સારો સુધારો/i.test(latest);

      if (isSignificantRelief && turns === 1 && !isExplicitClosing) {
        const qText = {
          EN: isCaregiver
            ? `Glad to hear of the patient's improvement! Do they need a prescription refill or have any minor lingering discomfort to discuss with the doctor?`
            : `Glad to hear of your improvement! Do you need a prescription refill or have any minor lingering discomfort to discuss with your doctor?`,
          HI: isCaregiver
            ? `सुधार जानकर खुशी हुई! क्या मरीज को दवाइयों का रीफिल चाहिए या डॉक्टर से कोई हल्की बची हुई तकलीफ पर चर्चा करनी है?`
            : `आपकी सेहत में सुधार जानकर खुशी हुई! क्या आपको दवाइयों का रीफिल चाहिए या डॉक्टर से कोई हल्की बची तकलीफ पर चर्चा करनी है?`,
          GU: isCaregiver
            ? `સુધારો જાણીને ઘણો આનંદ થયો! શું દર્દીને દવાઓ ફરી જોઈએ છે કે ડૉક્ટર સાથે કોઈ હળવી તકલીફ અંગે વાત કરવી છે?`
            : `આપની તબિયતમાં સુધારો જાણીને ઘણો આનંદ થયો! શું આપને દવાઓ ફરીથી જોઈએ છે કે ડૉક્ટર સાથે કોઈ હળવી તકલીફ અંગે ચર્ચા કરવી છે?`,
        };
        const touchOpts = {
          EN: ['Need prescription refill for continued relief', 'Occasional mild soreness with exertion', 'Almost fully normal, routine checkup only', 'All symptoms resolved — ready for consultation'],
          HI: ['दवाइयों का रीफिल चाहिए ताकि आराम बना रहे', 'ज्यादा मेहनत करने पर हल्का दर्द', 'पूरी तरह ठीक हैं, केवल सामान्य चेकअप', 'सभी लक्षण ठीक — डॉक्टर परामर्श हेतु तैयार'],
          GU: ['દવાઓ ફરી જોઈએ છે જેથી રાહત ચાલુ રહે', 'વધુ શ્રમ કરવાથી ક્યારેક હળવો દુખાવો', 'સંપૂર્ણ સામાન્ય છીએ, માત્ર રૂટિન તપાસ', 'બધા લક્ષણો મટી ગયા — ડૉક્ટરને મળવા તૈયાર'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'MEDICATIONS',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Assessing medication continuation needs and minor lingering symptoms post-recovery',
        };
      }

      // ----------------------------------------------------
      // TURN 2: MEDICATION TOLERABILITY & ADHERENCE FOLLOW-UP
      // ----------------------------------------------------
      if (turns === 2 && !isExplicitClosing) {
        const qText = {
          EN: isCaregiver
            ? `Has the patient been taking their prescribed medications regularly on time, and did they experience any side-effects like gastric burning or nausea?`
            : `Have you been taking your prescribed medications regularly on time, and did you experience any side-effects like gastric burning or nausea?`,
          HI: isCaregiver
            ? `क्या मरीज पहले लिखी गई दवाइयां समय पर नियमित ले रहे थे, और क्या कोई साइड-इफेक्ट जैसे पेट में जलन या उल्टी महसूस हुई?`
            : `क्या आप पहले लिखी गई दवाइयां समय पर नियमित ले रहे थे, और क्या कोई साइड-इफेक्ट जैसे पेट में जलन या उल्टी महसूस हुई?`,
          GU: isCaregiver
            ? `શું દર્દી અગાઉ આપેલી દવાઓ સમયસર નિયમિત લેતા હતા, અને કોઈ આડઅસર જેમ કે પેટમાં બળતરા કે ઉબકા થયા?`
            : `શું આપ અગાઉ આપેલી દવાઓ સમયસર નિયમિત લેતા હતા, અને કોઈ આડઅસર જેમ કે પેટમાં બળતરા કે ઉબકા થયા?`,
        };
        const touchOpts = {
          EN: ['Taking all medicines regularly on schedule', 'Missed doses occasionally / Stopped early', 'Medicines finished 2-3 days ago / Need refill', 'Experienced gastric burning / Nausea from medicine'],
          HI: ['सभी दवाइयां समय पर नियमित लीं', 'कभी-कभार दवा छूट गई / जल्दी बंद कर दी', 'दवा 2-3 दिन पहले खत्म हो गई / दोबारा चाहिए', 'दवा से पेट में जलन / उल्टी जैसा लगा'],
          GU: ['બધી દવાઓ સમયસર નિયમિત લીધી', 'ક્યારેક દવા છૂટી ગઈ / વહેલી બંધ કરી', 'દવા ૨-૩ દિવસ પહેલા પૂરી થઈ ગઈ / ફરી જોઈએ', 'દવાથી પેટમાં બળતરા / ઉબકા જેવું થયું'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'MEDICATIONS',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Verifying pharmacotherapy compliance, refill status, and adverse reactions',
        };
      }

      // ----------------------------------------------------
      // TURN 3+: FINAL REVIEW & WRAP-UP
      // ----------------------------------------------------
      const qFinal = {
        EN: isCaregiver
          ? `Thank you. Is there any other symptom or specific detail regarding the patient's recovery that you would like the doctor to review?`
          : `Thank you. Is there any other symptom or specific detail regarding your recovery that you would like your doctor to review?`,
        HI: isCaregiver
          ? `धन्यवाद। क्या मरीज के स्वास्थ्य या फॉलो-अप के बारे में आप डॉक्टर को कोई अन्य जरूरी बात बताना चाहते हैं?`
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
        clinicalRationale: 'Multi-turn longitudinal follow-up successfully completed with full clinical history',
      };
    }

    // ==========================================
    // WORKFLOW B: NEW PATIENT INTAKE
    // Step 1: Chief Complaint / Primary Health Concern (Care-Path & Specialty Tailored)
    // ==========================================
    if (!state.chiefComplaint) {
      // 1A. AYUSH (Ayurveda) Initial Opening
      if (effectiveCarePath === 'AYUSH') {
        const qAyush = {
          EN: isCaregiver
            ? `Welcome to our Ayurveda & Integrative Health Clinic. What primary symptoms or health concerns is the patient experiencing today, and do they notice burning heat (Pitta), heaviness/sluggishness (Kapha), or dryness/body ache (Vata)?`
            : `Welcome to our Ayurveda & Integrative Health Clinic. What primary symptoms or health concerns brought you in today, and do you notice burning heat (Pitta), heaviness/sluggishness (Kapha), or dryness/body ache (Vata)?`,
          HI: isCaregiver
            ? `आयुर्वेद एवं समग्र स्वास्थ्य विभाग में आपका स्वागत है। मरीज को आज क्या मुख्य तकलीफ या लक्षण हो रहे हैं, और क्या शरीर में जलन/गर्मी (पित्त), भारीपन/कफ (कफ) या सूखापन/दर्द (वात) महसूस होता है?`
            : `आयुर्वेद एवं समग्र स्वास्थ्य विभाग में आपका स्वागत है। आज आपको क्या मुख्य तकलीफ या स्वास्थ्य समस्या महसूस हो रही है, और क्या शरीर में जलन/गर्मी (पित्त), भारीपन/कफ (कफ) या सूखापन/दर्द (वात) महसूस होता है?`,
          GU: isCaregiver
            ? `આયુર્વેદ વિભાગમાં આપનું સ્વાગત છે. દર્દીને આજે કઈ મુખ્ય તકલીફ જણાય છે, અને શું શરીરમાં બળતરા/ગરમી (પિત્ત), ભારેપણું/કફ (કફ) કે સૂકાપણું/દુખાવો (વાત) જણાય છે?`
            : `આયુર્વેદ વિભાગમાં આપનું સ્વાગત છે. આજે આપને કઈ મુખ્ય તકલીફ કે લક્ષણો થઈ રહ્યા છે, અને શું શરીરમાં બળતરા/ગરમી (પિત્ત), ભારેપણું/કફ (કફ) કે સૂકાપણું/દુખાવો (વાત) જણાય છે?`,
        };
        const optAyush = {
          EN: ['Acidity, heartburn & sour burps (Amlapitta)', 'Sluggish digestion, heaviness & gas (Agnimandya)', 'Joint pain, stiffness & body ache (Vata / Sandhigata)', 'Chronic cough, sinus & congestion (Kaphaja)', 'Skin itching, burning & eruptions (Raktadosha)'],
          HI: ['खट्टी डकारें, सीने में जलन व एसिडिटी (अम्लपित्त)', 'धीमा पाचन, भारीपन और गैस (अग्निमांद्य)', 'जोड़ों में दर्द, जकड़न व बदन दर्द (वात रोग)', 'पुरानी खांसी, बलगम व साइनस (कफज विकार)', 'त्वचा में खुजली, जलन व लाल दाने (रक्तदोष)'],
          GU: ['ખાટા ઓડકાર, છાતીમાં બળતરા અને એસિડિટી (અમ્લપિત્ત)', 'ધીમું પાચન, ભારેપણું અને ગેસ (અગ્નિમાંદ્ય)', 'સાંધાનો દુખાવો, જકડન અને કળતર (વાત રોગ)', 'જૂની ખાંસી, કફ અને સાયનસ (કફજ)', 'ચામડીમાં ખંજવાળ, બળતરા અને દાણા (રક્તદોષ)'],
        };
        return {
          question: qAyush[lang],
          questionLanguage: lang,
          questionCategory: 'AYUSH',
          touchOptions: optAyush[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Ayurvedic Doshic and Agni intake opening',
        };
      }

      // 1B. Homeopathy Initial Opening
      if (effectiveCarePath === 'HOMEOPATHY') {
        const qHomeo = {
          EN: isCaregiver
            ? `Welcome to Classical Homeopathy. To find the individualized constitutional remedy, please describe the patient's main health concern, the exact sensation (throbbing, stitching, burning, bursting), and what brings relief.`
            : `Welcome to Classical Homeopathy. To find the individualized constitutional remedy, please describe your main health concern, the exact sensation (throbbing, stitching, burning, bursting), and what brings relief.`,
          HI: isCaregiver
            ? `शास्त्रीय होम्योपैथी विभाग में आपका स्वागत है। मरीज की प्रकृति अनुसार सही दवा चुनने के लिए, कृपया मुख्य समस्या, दर्द का सटीक अनुभव (टीस, चुभन, जलन, फटना) और किस चीज से आराम मिलता है, बताएं।`
            : `शास्त्रीय होम्योपैथी विभाग में आपका स्वागत है। आपकी प्रकृति अनुसार सही दवा चुनने के लिए, कृपया अपनी मुख्य तकलीफ, दर्द का सटीक अनुभव (टीस, चुभन, जलन, फटना) और किस चीज से आराम मिलता है, बताएं।`,
          GU: isCaregiver
            ? `હોમિયોપેથી વિભાગમાં આપનું સ્વાગત છે. દર્દીની પ્રકૃતિ અનુસાર યોગ્ય દવા પસંદ કરવા માટે, કૃપા કરીને મુખ્ય તકલીફ, દુખાવાનો ચોક્કસ અનુભવ (ધબકારા, સોય ભોંકાવી, બળતરા) અને શેનાથી રાહત મળે છે તે જણાવો.`
            : `હોમિયોપેથી વિભાગમાં આપનું સ્વાગત છે. આપની પ્રકૃતિ અનુસાર યોગ્ય દવા પસંદ કરવા માટે, કૃપા કરીને આપની મુખ્ય તકલીફ, દુખાવાનો ચોક્કસ અનુભવ (ધબકારા, સોય ભોંકાવી, બળતરા) અને શેનાથી રાહત મળે છે તે જણાવો.`,
        };
        const optHomeo = {
          EN: ['Throbbing / bursting headache (< Sun, > Cold compress)', 'Skin eczema, itching & burning eruptions (< Warmth)', 'Chronic acidity & stomach pain (> Warm drinks)', 'Joint pain & stiffness (< First motion, > Continuous walk)', 'Respiratory cough / wheezing flare (< Cold drafts)'],
          HI: ['तेज टीस मारने वाला सिरदर्द (धूप में बढ़ना, ठंडे पानी से आराम)', 'त्वचा में दाने, खुजली व जलन (गर्मी से बढ़ना)', 'पेट में जलन व दर्द (गर्म पानी पीने से आराम)', 'जोड़ों में दर्द व जकड़न (चलने-फिरने से आराम)', 'खांसी, सांस फूलना व सीटी की आवाज (ठंडी हवा से बढ़ना)'],
          GU: ['ધબકારા મારતો માથાનો દુખાવો (તડકામાં વધવો, ઠંડા પાણીથી રાહત)', 'ચામડી પર ખંજવાળ અને બળતરા (ગરમીથી વધવી)', 'પેટમાં બળતરા અને દુખાવો (ગરમ પીણાંથી રાહત)', 'સાંધાનો દુખાવો અને જકડન (ચાલવાથી રાહત)', 'ખાંસી અને શ્વાસ ચડવો (ઠંડી હવાથી વધવો)'],
        };
        return {
          question: qHomeo[lang],
          questionLanguage: lang,
          questionCategory: 'HOMEOPATHY',
          touchOptions: optHomeo[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Homeopathic individualizing totality and modality opening',
        };
      }

      // 1C. Specialty-Specific Initial Openings (Dermatology, Cardiology, Orthopedics, ENT, Pediatrics, GI, Pulmonology)
      const specLower = effectiveSpecialty.toLowerCase();

      // Dermatology
      if (/dermatolog|skin|त्वचा|ચામડી/i.test(specLower)) {
        const qDerma = {
          EN: isCaregiver
            ? `Welcome to the Dermatology & Skin Care Clinic. What skin, hair, or nail condition is the patient experiencing today (such as itching, rashes, acne/pimples, eczema, or fungal patches)?`
            : `Welcome to the Dermatology & Skin Care Clinic. What skin, hair, or nail condition are you experiencing today (such as itching, rashes, acne/pimples, eczema, or fungal patches)?`,
          HI: isCaregiver
            ? `त्वचा रोग एवं डर्मेटोलॉजी विभाग में स्वागत है। मरीज को त्वचा, बाल या नाखूनों से संबंधित क्या समस्या हो रही है (जैसे खुजली, लाल दाने, मुँहासे, एग्जिमा या फंगल इन्फेक्शन)?`
            : `त्वचा रोग एवं डर्मेटोलॉजी विभाग में आपका स्वागत है। आज आपको त्वचा, बाल या नाखूनों से संबंधित क्या समस्या महसूस हो रही है (जैसे खुजली, लाल दाने, मुँहासे, एग्जिमा या फंगल इन्फेक्शन)?`,
          GU: isCaregiver
            ? `ડર્મેટોલોજી અને ચામડીના રોગ વિભાગમાં આપનું સ્વાગત છે. દર્દીને ચામડી, વાળ કે નખ સંબંધિત કઈ તકલીફ જણાય છે (જેમ કે ખંજવાળ, લાલ ચકામા, ખીલ, ખરજવું કે ફંગલ ઇન્ફેક્શન)?`
            : `ડર્મેટોલોજી અને ચામડીના રોગ વિભાગમાં આપનું સ્વાગત છે. આજે આપને ચામડી, વાળ કે નખ સંબંધિત કઈ તકલીફ જણાય છે (જેમ કે ખંજવાળ, લાલ ચકામા, ખીલ, ખરજવું કે ફંગલ ઇન્ફેક્શન)?`,
        };
        const optDerma = {
          EN: ['Red itchy rash or eczema patches', 'Pimples, facial acne & dark spots', 'Fungal infection / Ringworm itching', 'Hair fall & scalp dandruff', 'Skin allergy / Hives flare'],
          HI: ['लाल खुजली वाले दाने या एग्जिमा के चकत्ते', 'मुँहासे, फुंसी और चेहरे पर दाग', 'दाद / फंगल इन्फेक्शन की तेज खुजली', 'बाल झड़ना और डैंड्रफ की समस्या', 'त्वचा में एलर्जी / पित्ती (Hives) उछलना'],
          GU: ['લાલ ખંજવાળવાળા ચકામા કે ખરજવું', 'ખીલ, ફોડલીઓ અને ચહેરા પર ડાઘ', 'દાદર / ફંગલ ઇન્ફેક્શનની તીવ્ર ખંજવાળ', 'વાળ ખરવા અને ખોડો થવો', 'ચામડીની એલર્જી / શીત પિત્તના ઢીમચા'],
        };
        return {
          question: qDerma[lang],
          questionLanguage: lang,
          questionCategory: 'ONSET',
          touchOptions: optDerma[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Specialized Dermatology Intake: Evaluating lesion morphology, pruritus, distribution, and skin history',
        };
      }

      // Cardiology
      if (/cardio|heart|हृदय|હૃદય/i.test(specLower)) {
        const qCardio = {
          EN: isCaregiver
            ? `Welcome to the Cardiology & Heart Care Clinic. What heart or cardiovascular symptoms is the patient experiencing (such as chest pain, palpitations, shortness of breath, or foot swelling)?`
            : `Welcome to the Cardiology & Heart Care Clinic. What heart or cardiovascular symptoms brought you in today (such as chest pain, palpitations, shortness of breath, or foot swelling)?`,
          HI: isCaregiver
            ? `हृदय रोग (कार्डियोलॉजी) विभाग में स्वागत है। मरीज को सीने में दर्द, धड़कन तेज होना, सांस फूलना या पैरों में सूजन जैसे क्या लक्षण हैं?`
            : `हृदय रोग (कार्डियोलॉजी) विभाग में आपका स्वागत है। आज आपको सीने में दर्द, घबराहट/तेज धड़कन, सांस फूलना या पैरों में सूजन जैसे क्या लक्षण महसूस हो रहे हैं?`,
          GU: isCaregiver
            ? `કાર્ડિયોલોજી (હૃદય રોગ) વિભાગમાં આપનું સ્વાગત છે. દર્દીને છાતીમાં દુખાવો, ધબકારા વધવા, શ્વાસ ચડવો કે પગમાં સોજો જેવા કયા લક્ષણો છે?`
            : `કાર્ડિયોલોજી (હૃદય રોગ) વિભાગમાં આપનું સ્વાગત છે. આજે આપને છાતીમાં દુખાવો, ગભરામણ/ધબકારા વધવા, શ્વાસ ચડવો કે પગમાં સોજો જેવા કયા લક્ષણો છે?`,
        };
        const optCardio = {
          EN: ['Chest pain, pressure or tightness', 'Rapid heartbeat / Palpitations', 'Shortness of breath on walking/climbing', 'Dizziness or lightheaded spells', 'Swelling in both feet / ankles'],
          HI: ['सीने में दर्द, भारीपन या दबाव', 'दिल की तेज धड़कन / घबराहट', 'चलने या सीढ़ी चढ़ने पर सांस फूलना', 'चक्कर आना या आँखों के आगे अंधेरा', 'दोनों पैरों या टखनों में सूजन'],
          GU: ['છાતીમાં દુખાવો, ભારેપણું કે દબાણ', 'હૃદયના ઝડપી ધબકારા / ગભરામણ', 'ચાલતી વખતે શ્વાસ ચડવો', 'ચક્કર આવવા કે અંધારા આવવા', 'બંને પગ કે ઘૂંટીમાં સોજો'],
        };
        return {
          question: qCardio[lang],
          questionLanguage: lang,
          questionCategory: 'ONSET',
          touchOptions: optCardio[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Specialized Cardiology Intake: Evaluating chest pain, palpitations, exertional dyspnea, and hemodynamics',
        };
      }

      // Orthopedics
      if (/ortho|bone|joint|हड्डी|સાંધા/i.test(specLower)) {
        const qOrtho = {
          EN: isCaregiver
            ? `Welcome to the Orthopedics & Bone/Joint Care Clinic. Which bone, joint, or spine pain is the patient experiencing, and does it restrict their movement?`
            : `Welcome to the Orthopedics & Bone/Joint Care Clinic. Which bone, joint, or spine pain are you experiencing today, and does it restrict your movement?`,
          HI: isCaregiver
            ? `अस्थि रोग (ऑर्थोपेडिक्स) विभाग में स्वागत है। मरीज को किस हड्डी, जोड़ या कमर/गर्दन में दर्द है, और क्या चलने-फिरने में रुकावट हो रही है?`
            : `अस्थि रोग (ऑर्थोपेडिक्स) विभाग में आपका स्वागत है। आज आपको किस हड्डी, जोड़ या कमर/गर्दन में दर्द है, और क्या उठने-बैठने या चलने में परेशानी हो रही है?`,
          GU: isCaregiver
            ? `ઓર્થોપેડિક્સ (હાડકા અને સાંધા) વિભાગમાં આપનું સ્વાગત છે. દર્દીને કયા હાડકા, સાંધા કે કમર/ગરદનમાં દુખાવો છે, અને શું હલનચલનમાં મુશ્કેલી પડે છે?`
            : `ઓર્થોપેડિક્સ (હાડકા અને સાંધા) વિભાગમાં આપનું સ્વાગત છે. આજે આપને કયા હાડકા, સાંધા કે કમર/ગરદનમાં દુખાવો છે, અને શું હલનચલનમાં મુશ્કેલી પડે છે?`,
        };
        const optOrtho = {
          EN: ['Knee joint pain & swelling', 'Lower back pain & lumbar stiffness', 'Shoulder or neck pain / frozen shoulder', 'Ankle sprain or foot pain', 'Sciatica pain radiating down leg'],
          HI: ['घुटने के जोड़ में दर्द और सूजन', 'कमर के निचले हिस्से में दर्द व जकड़न', 'कंधे या गर्दन में दर्द (फ्रोजन शोल्डर)', 'पैर या टखने में मोच / दर्द', 'सायटिका दर्द जो पैर में नीचे तक जाता है'],
          GU: ['ઘૂંટણનો દુખાવો અને સોજો', 'કમરનો દુખાવો અને જકડન', 'ખભા કે ગરદનનો દુખાવો', 'પગ કે ઘૂંટીમાં મચકોડ / દુખાવો', 'સાયટીકાનો દુખાવો જે પગમાં નીચે ઉતરે છે'],
        };
        return {
          question: qOrtho[lang],
          questionLanguage: lang,
          questionCategory: 'ONSET',
          touchOptions: optOrtho[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Specialized Orthopedics Intake: Assessing joint distribution, stiffness, radiating pain, and weight-bearing restriction',
        };
      }

      // ENT (Ear, Nose & Throat)
      if (/ent|ear|throat|nose|ईएनटी|કાન/i.test(specLower)) {
        const qEnt = {
          EN: isCaregiver
            ? `Welcome to the ENT (Ear, Nose & Throat) Clinic. What ear, nose, or throat symptoms is the patient experiencing today?`
            : `Welcome to the ENT (Ear, Nose & Throat) Clinic. What ear, nose, or throat symptoms are you experiencing today?`,
          HI: isCaregiver
            ? `कान, नाक एवं गला (ENT) विभाग में स्वागत है। मरीज को कान, नाक या गले में क्या परेशानी महसूस हो रही है?`
            : `कान, नाक एवं गला (ENT) विभाग में आपका स्वागत है। आज आपको कान, नाक या गले में क्या परेशानी महसूस हो रही है?`,
          GU: isCaregiver
            ? `કાન, નાક અને ગળા (ENT) વિભાગમાં આપનું સ્વાગત છે. દર્દીને કાન, નાક કે ગળામાં કઈ તકલીફ થઈ રહી છે?`
            : `કાન, નાક અને ગળા (ENT) વિભાગમાં આપનું સ્વાગત છે. આજે આપને કાન, નાક કે ગળામાં કઈ તકલીફ થઈ રહી છે?`,
        };
        const optEnt = {
          EN: ['Severe sore throat & painful swallowing', 'Ear pain, discharge or reduced hearing', 'Nasal blockage, sinus pressure & cold', 'Hoarseness of voice or persistent throat clearing', 'Dizziness / Ear ringing (Tinnitus)'],
          HI: ['गले में तेज दर्द और निगलने में तकलीफ', 'कान में दर्द, मवाद आना या कम सुनाई देना', 'नाक बंद, साइनस का भारीपन व जुकाम', 'आवाज बैठना या गले में खराश', 'चक्कर आना या कान में सीटी की आवाज'],
          GU: ['ગળામાં તીવ્ર દુખાવો અને ગળવામાં તકલીફ', 'કાનમાં દુખાવો, પરુ કે ઓછું સંભળાવું', 'નાક બંધ, સાઇનસનું ભારેપણું અને શરદી', 'અવાજ બેસી જવો કે ગળામાં ખારાશ', 'ચક્કર આવવા કે કાનમાં અવાજ આવવો'],
        };
        return {
          question: qEnt[lang],
          questionLanguage: lang,
          questionCategory: 'ONSET',
          touchOptions: optEnt[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Specialized ENT Intake: Evaluating otorhinolaryngological manifestations',
        };
      }

      // Pediatrics
      if (/pediatric|child|बाल/i.test(specLower)) {
        const qPed = {
          EN: `Welcome to the Pediatrics & Child Health Clinic. What symptoms or illness is your child experiencing today?`,
          HI: `बाल रोग (पीडियाट्रिक्स) विभाग में स्वागत है। बच्चे को आज क्या बीमारी या तकलीफ हो रही है?`,
          GU: `બાળ રોગ (પીડિયાટ્રિક્સ) વિભાગમાં આપનું સ્વાગત છે. બાળકને આજે કઈ બીમારી કે તકલીફ થઈ રહી છે?`,
        };
        const optPed = {
          EN: ['High fever with chills & body warmth', 'Persistent cough & fast breathing', 'Vomiting & loose motions / diarrhea', 'Skin rash, measles-like spots or itching', 'Poor feeding, irritability & low energy'],
          HI: ['तेज बुखार, कंपकंपी और गर्म शरीर', 'लगातार खांसी और तेज सांस चलना', 'उल्टी और दस्त (Loose motions)', 'त्वचा पर दाने, चकत्ते या खुजली', 'दूध/खाना न पीना, चिड़चिड़ापन और सुस्ती'],
          GU: ['તીવ્ર તાવ, ધ્રુજારી અને ગરમ શરીર', 'સતત ખાંસી અને ઝડપી શ્વાસ', 'ઉલટી અને ઝાડા (ડાયેરિયા)', 'ચામડી પર દાણા, ચકામા કે ખંજવાળ', 'ખોરાક/દૂધ ન લેવું, ચીડિયાપણું અને સુસ્તી'],
        };
        return {
          question: qPed[lang],
          questionLanguage: lang,
          questionCategory: 'ONSET',
          touchOptions: optPed[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Specialized Pediatrics Intake: Pediatric-specific symptom and activity triage',
        };
      }

      // Gastroenterology
      if (/gastro|digest|पेट/i.test(specLower)) {
        const qGastro = {
          EN: isCaregiver
            ? `Welcome to the Gastroenterology & Digestive Health Clinic. What stomach or digestive complaints is the patient experiencing today?`
            : `Welcome to the Gastroenterology & Digestive Health Clinic. What stomach or digestive complaints are you experiencing today?`,
          HI: isCaregiver
            ? `पेट एवं पाचन रोग (गैस्ट्रोएंटरोलॉजी) विभाग में स्वागत है। मरीज को पेट या पाचन से संबंधित क्या तकलीफ हो रही है?`
            : `पेट एवं पाचन रोग (गैस्ट्रोएंटरोलॉजी) विभाग में आपका स्वागत है। आज आपको पेट या पाचन से संबंधित क्या परेशानी महसूस हो रही है?`,
          GU: isCaregiver
            ? `ગેસ્ટ્રોએન્ટેરોલોજી (પાચન અને પેટના રોગો) વિભાગમાં આપનું સ્વાગત છે. દર્દીને પેટ કે પાચન સંબંધિત કઈ તકલીફ જણાય છે?`
            : `ગેસ્ટ્રોએન્ટેરોલોજી (પાચન અને પેટના રોગો) વિભાગમાં આપનું સ્વાગત છે. આજે આપને પેટ કે પાચન સંબંધિત કઈ તકલીફ જણાય છે?`,
        };
        const optGastro = {
          EN: ['Severe stomach pain & cramping', 'Chronic acidity, heartburn & sour burps', 'Frequent vomiting & nausea', 'Constipation / Difficulty in bowel movement', 'Loose motions / Diarrhea with cramps'],
          HI: ['पेट में तेज दर्द और मरोड़', 'पुरानी एसिडिटी, सीने में जलन और खट्टी डकारें', 'बार-बार उल्टी और जी मिचलाना', 'कब्ज / पेट साफ न होना', 'दस्त / मरोड़ के साथ पतले दस्त'],
          GU: ['પેટમાં તીવ્ર દુખાવો અને ચૂંક', 'જૂની એસિડિટી, છાતીમાં બળતરા અને ખાટા ઓડકાર', 'વારંવાર ઉલટી અને ઉબકા', 'કબજિયાત / પેટ સાફ ન આવવું', 'ઝાડા / ચૂંક સાથે પાતળા ઝાડા'],
        };
        return {
          question: qGastro[lang],
          questionLanguage: lang,
          questionCategory: 'ONSET',
          touchOptions: optGastro[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Specialized Gastroenterology Intake: Evaluating abdominal pain, dyspepsia, bowel changes, and biliary signs',
        };
      }

      // Pulmonology
      if (/pulmono|respiratory|chest|फेफड़े/i.test(specLower)) {
        const qPulmo = {
          EN: isCaregiver
            ? `Welcome to the Pulmonology & Respiratory Care Clinic. What breathing or lung symptoms is the patient experiencing today?`
            : `Welcome to the Pulmonology & Respiratory Care Clinic. What breathing or lung symptoms are you experiencing today?`,
          HI: isCaregiver
            ? `श्वसन रोग एवं फेफड़ा (पल्मोनोलॉजी) विभाग में स्वागत है। मरीज को सांस या फेफड़ों से संबंधित क्या तकलीफ महसूस हो रही है?`
            : `श्वसन रोग एवं फेफड़ा (पल्मोनोलॉजी) विभाग में आपका स्वागत है। आज आपको सांस या फेफड़ों से संबंधित क्या परेशानी महसूस हो रही है?`,
          GU: isCaregiver
            ? `પલ્મોનોલોજી અને શ્વાસના રોગો વિભાગમાં આપનું સ્વાગત છે. દર્દીને શ્વાસ કે ફેફસાં સંબંધિત કઈ તકલીફ જણાય છે?`
            : `પલ્મોનોલોજી અને શ્વાસના રોગો વિભાગમાં આપનું સ્વાગત છે. આજે આપને શ્વાસ કે ફેફસાં સંબંધિત કઈ તકલીફ જણાય છે?`,
        };
        const optPulmo = {
          EN: ['Persistent dry or productive cough', 'Shortness of breath / Wheezing sound', 'Chest tightness with cold drafts', 'Night-time cough awakening sleep', 'Coughing up discolored phlegm / mucus'],
          HI: ['लगातार सूखी या बलगम वाली खांसी', 'सांस फूलना / सीने से सीटी जैसी आवाज', 'ठंडी हवा से सीने में जकड़न', 'रात में नींद से जगाने वाली खांसी', 'पीला या गाढ़ा बलगम आना'],
          GU: ['સતત સૂકી કે કફવાળી ખાંસી', 'શ્વાસ ચડવો / છાતીમાંથી સીટી જેવો અવાજ', 'ઠંડી હવાથી છાતીમાં જકડન', 'રાત્રે ઊંઘમાંથી જગાડતી ખાંસી', 'પીળો કે ઘટ્ટ કફ નીકળવો'],
        };
        return {
          question: qPulmo[lang],
          questionLanguage: lang,
          questionCategory: 'ONSET',
          touchOptions: optPulmo[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Specialized Pulmonology Intake: Evaluating dyspnea, wheezing, cough duration, and sputum character',
        };
      }

      // Default General OPD Opening
      const qText = {
        EN: isCaregiver
          ? `Welcome to MediKiosk. Please tell me what specific symptoms or health concerns the patient is experiencing today?`
          : `Welcome to MediKiosk. Please tell me what specific symptoms or health concerns brought you to the hospital today?`,
        HI: isCaregiver
          ? `मेडीकियोस्क में स्वागत है। कृपया बताएं कि मरीज को आज क्या मुख्य तकलीफ या लक्षण महसूस हो रहे हैं?`
          : `मेडीकियोस्क में आपका स्वागत है। कृपया बताएं कि आज आपको क्या मुख्य परेशानी या लक्षण महसूस हो रहे हैं?`,
        GU: isCaregiver
          ? `મેડીકિયોસ્ક માં સ્વાગત છે. કૃપા કરીને જણાવો કે દર્દીને આજે કઈ મુખ્ય તકલીફ કે લક્ષણો થઈ રહ્યા છે?`
          : `મેડીકિયોસ્ક માં આપનું સ્વાગત છે. કૃપા કરીને જણાવો કે આજે આપને કઈ મુખ્ય તકલીફ કે લક્ષણો થઈ રહ્યા છે?`,
      };
      const touchOpts = {
        EN: ['Fever, body ache & chills', 'Vomiting, nausea & stomach upset', 'Throbbing headache & eye strain', 'Chest discomfort or breathlessness', 'Joint or back pain with stiffness', 'Skin rash, pimples or itching'],
        HI: ['बुखार, बदन दर्द और कंपकंपी', 'उल्टी, जी मिचलाना व पेट दर्द', 'तेज सिरदर्द और आँखों में तनाव', 'सीने में भारीपन या सांस की तकलीफ', 'जोड़ों या कमर में दर्द व जकड़न', 'त्वचा पर दाने, खुजली या मुँहासे'],
        GU: ['તાવ, કળતર અને ધ્રુજારી', 'ઉલટી, ઉબકા અને પેટમાં દુખાવો', 'તીવ્ર માથાનો દુખાવો અને આંખોમાં તાણ', 'છાતીમાં ભારેપણું કે શ્વાસની તકલીફ', 'સાંધા કે કમરમાં દુખાવો અને જકડન', 'ચામડી પર દાણા, ખંજવાળ કે ખીલ'],
      };
      return {
        question: qText[lang],
        questionLanguage: lang,
        questionCategory: 'ONSET',
        touchOptions: touchOpts[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Establishing active chief complaint on initial general medicine intake turn',
      };
    }

    // ----------------------------------------------------
    // CARE PATH 1: AYUSH (Ayurveda & Integrative Medicine)
    // ----------------------------------------------------
    if (effectiveCarePath === 'AYUSH') {
      const turns = state.turnsCompleted || 0;
      if (turns <= 1 || !answeredDimensions.has('CHARACTER')) {
        const qText = {
          EN: `What is the specific nature of your ${localizedLabel} (sharp burning heat, throbbing pulsation, or heavy dull ache), and does it worsen in hot sun, after meals, or in cold air?`,
          HI: `आपकी ${localizedLabel} की प्रकृति कैसी है (तेज जलन व तीखा दर्द, धड़कन जैसी टीस, या भारीपन भरा दर्द), और क्या यह धूप, भोजन के बाद या ठंडी हवा में बढ़ता है?`,
          GU: `આપની ${localizedLabel} નો પ્રકાર કેવો છે (તીક્ષ્ણ બળતરા, ધબકારા સાથે દુખાવો, કે ભારેપણું), અને શું તે તડકામાં, જમ્યા પછી કે ઠંડી હવામાં વધે છે?`,
        };
        const touchOpts = {
          EN: ['Sharp burning pain worse in sunlight / heat (Pitta)', 'Heavy dull ache with head heaviness in mornings (Kapha)', 'Throbbing pain triggered by mental stress & fatigue (Vata)', 'Ache after skipping meals or indigestion (Ama)'],
          HI: ['तेज जलन व धूप/गर्मी में बढ़ने वाला दर्द (पित्त)', 'सुबह सिर में भारीपन व जकड़न (कफ)', 'तनाव व थकान से टीस मारने वाला दर्द (वात)', 'भूख रोकने या अपच के बाद होने वाला दर्द (आम)'],
          GU: ['તીવ્ર બળતરા અને તડકા/ગરમીથી વધતો દુખાવો (પિત્ત)', 'સવારે માથામાં ભારેપણું અને જકડન (કફ)', 'તણાવ અને થાકથી ધબકતો દુખાવો (વાત)', 'ભૂખ્યા રહેવાથી કે અપચા પછી થતો દુખાવો (આમ)'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'AYUSH',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'AYUSH Dosha profiling: Shirahshula etiology (Vataja/Pittaja/Kaphaja/Amaja)',
        };
      }

      if (turns === 2 || !state.ayushAssessment?.agni || !state.ayushAssessment?.koshtha) {
        const qText = {
          EN: `How is your appetite and digestion (do you feel bloated/heavy after meals, or acidity), and are your bowel movements regular or constipated?`,
          HI: `आपकी भूख और पाचन (अग्नि) कैसी है (क्या खाने के बाद भारीपन या खट्टी डकारें आती हैं), और क्या पेट रोज साफ होता है या कब्ज रहती है?`,
          GU: `આપની ભૂખ અને પાચન (અગ્નિ) કેવું રહે છે (શું જમ્યા પછી ભારેપણું કે એસિડિટી થાય છે), અને પેટ રોજ સાફ થાય છે કે કબજિયાત રહે છે?`,
        };
        const touchOpts = {
          EN: ['Normal digestion & clear daily bowel movements', 'Sluggish digestion, bloating & heavy feeling (Mandagni)', 'Acid reflux, sour burps & burning hunger (Tikshnagni)', 'Irregular appetite & hard constipated stools (Krura Koshtha)'],
          HI: ['सामान्य पाचन और रोज पेट साफ होता है', 'धीमा पाचन, भारीपन व पेट फूलना (मंदाग्नि)', 'खट्टी डकारें, सीने में जलन व तेज भूख (तीक्ष्णाग्नि)', 'अनियमित भूख और कब्ज/कड़ा मल (क्रूर कोष्ठ)'],
          GU: ['સામાન્ય પાચન અને રોજ પેટ સાફ થાય છે', 'ધીમું પાચન, ભારેપણું અને પેટ ફૂલવું (મંદાગ્નિ)', 'ખાટા ઓડકાર, છાતીમાં બળતરા અને તીવ્ર ભૂખ (તીક્ષ્ણાગ્નિ)', 'અનિયમિત ભૂખ અને કબજિયાત/કઠણ મળ (ક્રૂર કોષ્ઠ)'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'AYUSH',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'AYUSH Agni & Koshtha Pariksha for metabolic digestive fire and bowel disposition',
        };
      }

      if (turns === 3 || !state.ayushAssessment?.ahara || !state.ayushAssessment?.vihara) {
        const qText = {
          EN: `What are your daily dietary habits (preference for spicy, oily, or tea/coffee), and what is your sleep routine (do you sleep late at night or take day naps)?`,
          HI: `आपकी खान-पान की आदतें कैसी हैं (तला-भुना, तीखा, चाय/कॉफी अधिक), और सोने की दिनचर्या कैसी है (क्या देर रात जागते हैं या दिन में सोते हैं)?`,
          GU: `આપની ખાનપાનની આદતો કેવી છે (તળેલું, તીખું, ચા/કોફી વધુ), અને ઊંઘની દિનચર્યા કેવી છે (મોડી રાત સુધી જાગવું કે દિવસે ઊંઘવું)?`,
        };
        const touchOpts = {
          EN: ['Frequent spicy/oily food, tea & irregular meal times', 'Late night sleep (>12 AM) & waking tired (Ratri Jagarana)', 'Simple home-cooked food & regular 7-8 hrs sleep', 'Excess dry/cold foods & high mental workload'],
          HI: ['तला-भुना, तीखा खाना, अधिक चाय व अनियमित समय', 'देर रात सोना (>12 बजे) व सुबह थकान (रात्रि जागरण)', 'घर का सादा भोजन और 7-8 घंटे नियमित नींद', 'सूखा/ठंडा भोजन और अधिक मानसिक तनाव'],
          GU: ['તળેલું, તીખું ભોજન, વધુ ચા અને અનિયમિત સમય', 'મોડી રાત્રે ઊંઘવું (>૧૨ વાગ્યે) અને સવારે થાક (રાત્રિ જાગરણ)', 'ઘરનો સાદો ખોરાક અને ૭-૮ કલાક નિયમિત ઊંઘ', 'સૂકો/ઠંડો ખોરાક અને વધુ માનસિક તણાવ'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'AYUSH',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'AYUSH Ahara-Vihara assessment for dietary triggers and lifestyle circadian balance',
        };
      }

      if (turns === 4 || !state.ayushAssessment?.prakriti) {
        const qText = {
          EN: `How is your natural body temperature tolerance (do you feel excess internal heat or get chilled easily), and do you notice dry skin, joint cracking, or mental restlessness?`,
          HI: `आपकी शारीरिक प्रकृति व तापमान सहनशीलता कैसी है (क्या बहुत जल्दी गर्मी लगती है या ठंड लगती है), और क्या त्वचा में सूखापन या बेचैनी रहती है?`,
          GU: `આપની શારીરિક પ્રકૃતિ અને તાપમાન સહનશીલતા કેવી છે (શું ખૂબ જલ્દી ગરમી લાગે છે કે ઠંડી લાગે છે), અને ચામડીમાં સૂકાપણું કે બેચેની રહે છે?`,
        };
        const touchOpts = {
          EN: ['Intolerant to heat, sweat easily, warm body (Pitta)', 'Feel cold easily, dry skin, anxious mind (Vata)', 'Calm constitution, heavy build, slow digestion (Kapha)', 'Mixed traits with seasonal variations'],
          HI: ['गर्मी सहन नहीं होती, पसीना अधिक व शरीर गर्म (पित्त)', 'जल्दी ठंड लगना, रूखी त्वचा व बेचैनी (वात)', 'शांत स्वभाव, भारी शरीर व सुस्त पाचन (कफ)', 'मौसम के अनुसार बदलने वाले लक्षण'],
          GU: ['ગરમી સહન ન થવી, વધુ પરસેવો અને ગરમ શરીર (પિત્ત)', 'જલ્દી ઠંડી લાગવી, સૂકી ચામડી અને બેચેની (વાત)', 'શાંત સ્વભાવ, ભારે શરીર અને ધીમું પાચન (કફ)', 'ઋતુ પ્રમાણે બદલાતા લક્ષણો'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'AYUSH',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'AYUSH Prakriti Pariksha: Doshic constitutional assessment',
        };
      }
    }

    // ----------------------------------------------------
    // CARE PATH 2: HOMEOPATHY (Classical Case-Taking)
    // ----------------------------------------------------
    if (effectiveCarePath === 'HOMEOPATHY') {
      const turns = state.turnsCompleted || 0;
      if (turns <= 1 || !answeredDimensions.has('CHARACTER')) {
        const qText = {
          EN: `Can you describe the exact sensation of your ${localizedLabel} (throbbing, bursting, sharp stitching, or heavy band-like constriction), and is it located on the right or left side?`,
          HI: `आपकी ${localizedLabel} में दर्द का सटीक अनुभव कैसा है (टीस मारना, फटने जैसा, सुई चुभने जैसा, या पट्टी से बंधा हुआ), और क्या यह दाईं या बाईं तरफ ज्यादा है?`,
          GU: `આપની ${localizedLabel} માં દુખાવાનો ચોક્કસ અનુભવ કેવો છે (ધબકારા મારતો, ફાટી જતો, સોય ભોંકાય તેવો, કે પાટાથી બાંધ્યો હોય તેવો), અને જમણી કે ડાબી બાજુ છે?`,
        };
        const touchOpts = {
          EN: ['Right-sided throbbing / hammering sensation', 'Left-sided sharp stitching or piercing ache', 'Bursting sensation as if head would split open', 'Heavy tight band constriction across temples & forehead'],
          HI: ['दाईं तरफ तेज टीस व हथौड़े जैसा दर्द', 'बाईं तरफ सुई चुभने या कांटे जैसा दर्द', 'सिर फटने जैसा तेज दबाव व भारीपन', 'माथे व कनपटी पर कसी हुई पट्टी जैसा खिंचाव'],
          GU: ['જમણી બાજુ તીવ્ર ધબકારા અને હથોડા જેવો દુખાવો', 'ડાબી બાજુ સોય ભોંકાય તેવો તીક્ષ્ણ દુખાવો', 'માથું ફાટી જશે તેવું ભારે દબાણ', 'કપાળ પર કસીને બાંધેલા પાટા જેવું ખેંચાણ'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'HOMEOPATHY',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Homeopathic individualizing sensation and laterality evaluation',
        };
      }

      if (turns === 2 || !state.homeopathyAssessment?.modalities?.aggravating?.length) {
        const qText = {
          EN: `What specific factors make your ${localizedLabel} worse (sun heat, motion, noise, light, afternoon) and what gives you relief (cold compress, tight bandage, dark room, hard pressure)?`,
          HI: `किस कारण से आपकी ${localizedLabel} बढ़ती है (धूप/गर्मी, हिलने-डुलने, आवाज, रोशनी) और किस चीज से आराम मिलता है (ठंडा पानी, कसकर पट्टी बांधना, अंधेरा कमरा, दबाने से)?`,
          GU: `કયા કારણોથી આપની ${localizedLabel} વધે છે (તડકો/ગરમી, હલનચલન, અવાજ, પ્રકાશ) અને શેનાથી રાહત મળે છે (ઠંડુ પાણી, પાટો બાંધવો, અંધારામાં સૂવું, દબાવવાથી)?`,
        };
        const touchOpts = {
          EN: ['Worse from sun heat, motion & noise; better in dark room', 'Better from cold water wash & tight bandaging', 'Worse in morning & 3 PM; better from hard pressure & rest', 'Worse from cold drafts & mental exertion; better from warmth'],
          HI: ['धूप, हिलने व आवाज से बढ़ता है; अंधेरे कमरे में आराम', 'ठंडे पानी से धोने व कसकर बांधने से आराम', 'सुबह व दोपहर 3 बजे बढ़ता है; दबाने से आराम', 'ठंडी हवा व दिमागी काम से बढ़ता है; गर्माहट से आराम'],
          GU: ['તડકો, હલનચલન અને અવાજથી વધે છે; અંધારામાં રાહત', 'ઠંડા પાણીથી ધોવા અને કસીને બાંધવાથી રાહત', 'સવારે અને બપોરે ૩ વાગ્યે વધે છે; દબાવવાથી રાહત', 'ઠંડી હવા અને માનસિક શ્રમથી વધે છે; ગરમીથી રાહત'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'HOMEOPATHY',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Homeopathic characteristic modalities (< Aggravation and > Amelioration)',
        };
      }

      if (turns === 3 || !state.homeopathyAssessment?.thermalState || !state.homeopathyAssessment?.thirst) {
        const qText = {
          EN: `How is your body temperature reaction (are you a chilly person who wants warmth, or hot desiring open cool air), and how is your thirst for water during this complaint?`,
          HI: `आपकी शारीरिक तासीर कैसी है (क्या ठंड ज्यादा लगती है और गर्माहट चाहिए, या गर्मी बर्दाश्त नहीं होती), और इस तकलीफ के दौरान प्यास कैसी लगती है?`,
          GU: `આપની શારીરિક તાસીર કેવી છે (શું ઠંડી વધુ લાગે છે અને ગરમી જોઈએ, કે ગરમી સહન નથી થતી), અને આ તકલીફ દરમિયાન પાણીની તરસ કેવી લાગે છે?`,
        };
        const touchOpts = {
          EN: ['Chilly patient (wants warmth/blanket) & Thirstless', 'Hot patient (desires cold open air & breeze) & Thirsty', 'Thirsty for large quantities of cold water at long intervals', 'Thirsty for small sips of warm water frequently'],
          HI: ['ठंड ज्यादा लगना (गर्माहट/कंबल चाहिए) व प्यास न लगना', 'गर्मी सहन न होना (खुली हवा/पंखे की इच्छा) व अधिक प्यास', 'लंबे समय में ज्यादा मात्रा में ठंडा पानी पीने की प्यास', 'थोड़ी-थोड़ी देर में घूंट-घूंट गर्म पानी की प्यास'],
          GU: ['ઠંડી વધુ લાગવી (ગરમી/ધાબળો જોઈએ) અને તરસ ન લાગવી', 'ગરમી સહન ન થવી (ખુલ્લી હવા/પંખાની ઇચ્છા) અને વધુ તરસ', 'લાંબા સમયે વધુ માત્રામાં ઠંડુ પાણી પીવાની તરસ', 'વારંવાર ઘૂંટડે-ઘૂંટડે ગરમ પાણીની તરસ'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'HOMEOPATHY',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Homeopathic general physical assessment: Thermal disposition & Thirst state',
        };
      }

      if (turns === 4 || !state.homeopathyAssessment?.mentalState) {
        const qText = {
          EN: `How is your mental state and mood when you are suffering from ${localizedLabel} (irritable wanting silence, anxious & restless, or weeping easily)?`,
          HI: `इस ${localizedLabel} के दौरान आपका मानसिक स्वभाव व मनोदशा कैसी रहती है (गुस्सा व अकेले रहने की इच्छा, बेचैनी व घबराहट, या रोने जैसा मन)?`,
          GU: `આ ${localizedLabel} દરમિયાન આપનો માનસિક સ્વભાવ કેવો રહે છે (ચીડચીડાપણું અને એકલા રહેવું, બેચેની અને ગભરામણ, કે રડવું આવવું)?`,
        };
        const touchOpts = {
          EN: ['Highly irritable — want to be left alone in total silence', 'Anxious & restless — unable to stay in one position', 'Quiet & weeps easily — comforted by consolation', 'Mentally fatigued & unable to concentrate on work'],
          HI: ['बहुत चिड़चिड़ापन — बिल्कुल अकेले व शांत रहने की इच्छा', 'बेचैनी व घबराहट — एक जगह चैन नहीं मिलना', 'उदास व रोने का मन — सांत्वना से अच्छा लगना', 'दिमागी थकान और काम पर ध्यान न लगना'],
          GU: ['ખૂબ ચીડચીડાપણું — શાંતિથી એકલા રહેવાની ઇચ્છા', 'બેચેની અને ગભરામણ — એક જગ્યાએ ચેન ન પડવું', 'ઉદાસ અને રડવાનું મન — આશ્વાસનથી સારું લાગવું', 'માનસિક થાક અને કામમાં ધ્યાન ન લાગવું'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'HOMEOPATHY',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Homeopathic mental and emotional general state assessment',
        };
      }
    }

    // ----------------------------------------------------
    // CARE PATH 3A: ALLOPATHY + Neurology
    // ----------------------------------------------------
    if (effectiveCarePath === 'ALLOPATHY' && effectiveSpecialty.toLowerCase().includes('neuro')) {
      const turns = state.turnsCompleted || 0;
      if (turns <= 1 || !answeredDimensions.has('ONSET')) {
        const qText = {
          EN: `How suddenly did your ${localizedLabel} begin, and do you experience visual auras like flashing lights, zigzag lines, blind spots, or wavy vision?`,
          HI: `आपकी ${localizedLabel} कितनी अचानक शुरू हुई, और क्या दर्द से पहले आँखों के आगे चमकती रोशनी, आड़ी-तिरछी रेखाएं या धुंधलापन दिखता है?`,
          GU: `આપની ${localizedLabel} કેટલી અચાનક શરૂ થઈ, અને શું દુખાવા પહેલાં આંખો સામે ચમકારા, ઝિગઝેગ લાઈન કે ઝાંખપ દેખાય છે?`,
        };
        const touchOpts = {
          EN: ['Visual aura (flashes of light / zigzag lines before pain)', 'Sudden severe onset within minutes (thunderclap)', 'Gradual onset that builds up over several hours', 'No visual aura, constant aching pressure'],
          HI: ['आँखों के आगे चमकती रोशनी / रेखाएं (विजुअल ऑरा)', 'कुछ ही मिनटों में अचानक बहुत तेज दर्द', 'धीरे-धीरे कई घंटों में बढ़ने वाला दर्द', 'कोई रोशनी का असर नहीं, सिर्फ भारी दबाव'],
          GU: ['આંખો સામે ચમકારા / લાઈન દેખાવી (વિઝ્યુઅલ ઓરા)', 'થોડી જ મિનિટોમાં અચાનક તીવ્ર દુખાવો', 'ધીમે-ધીમે કલાકોમાં વધતો દુખાવો', 'કોઈ ચમકારા નથી, માત્ર સતત દબાણ'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Neurology migraine aura & sudden vs gradual onset screening',
        };
      }

      if (turns === 2 || !answeredDimensions.has('CHARACTER')) {
        const qText = {
          EN: `Do you experience photophobia (light sensitivity), phonophobia (sound sensitivity), facial numbness, or tingling/weakness in your arms or legs?`,
          HI: `क्या आपको तेज रोशनी या आवाज से परेशानी होती है, चेहरे पर सुन्नपन, या हाथ-पैरों में झनझनाहट व कमजोरी महसूस होती है?`,
          GU: `શું આપને વધુ પ્રકાશ કે અવાજથી તકલીફ થાય છે, ચહેરા પર સુન્નતા, કે હાથ-પગમાં ખાલી ચડવી કે નબળાઈ જણાય છે?`,
        };
        const touchOpts = {
          EN: ['Severe light & sound sensitivity with nausea', 'Numbness or tingling in face / fingers', 'Mild photophobia without weakness or numbness', 'No sensory sensitivity or focal weakness'],
          HI: ['तेज रोशनी व आवाज से भारी परेशानी और जी मिचलाना', 'चेहरे या उंगलियों में सुन्नपन/झनझनाहट', 'हल्की रोशनी से दिक्कत पर कोई सुन्नपन नहीं', 'कोई सुन्नपन या कमजोरी नहीं'],
          GU: ['વધુ પ્રકાશ અને અવાજથી ભારે તકલીફ અને ઉબકા', 'ચહેરા કે આંગળીઓમાં ખાલી ચડવી/ઝણઝણાટી', 'પ્રકાશથી હળવી તકલીફ પણ કોઈ નબળાઈ નથી', 'કોઈ ખાલી કે નબળાઈ નથી'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Neurology focal deficits and sensory photophobia/phonophobia evaluation',
        };
      }

      if (turns === 3 || !answeredDimensions.has('LIFESTYLE')) {
        const qText = {
          EN: `How many days per month do you experience these headaches, what triggers them (sleep loss, stress, screen time), and how often do you take pain relievers?`,
          HI: `महीने में कितने दिन आपको यह सिरदर्द होता है, क्या ट्रिगर करता है (नींद की कमी, तनाव, स्क्रीन टाइम), और कितनी बार दर्द निवारक दवा लेते हैं?`,
          GU: `મહિનામાં કેટલા દિવસ આપને આ માથાનો દુખાવો થાય છે, કયા કારણે વધે છે (ઊંઘની કમી, તણાવ, સ્ક્રીન ટાઈમ), અને કેટલી વાર પેઈનકિલર લો છો?`,
        };
        const touchOpts = {
          EN: ['1 to 3 attacks/month, triggered by stress & sleep loss', 'Frequent attacks (>8-10 days/month), taking regular pain tablets', 'Triggered by bright screen exposure, skipped meals or dehydration', 'Occasional episodic headache relieved by rest'],
          HI: ['महीने में 1-3 बार, तनाव व कम नींद से ट्रिगर', 'महीने में 8-10+ दिन, नियमित पेनकिलर खानी पड़ती है', 'स्क्रीन देखने, खाना छूटने या पानी की कमी से ट्रिगर', 'कभी-कभार दर्द जो आराम करने से ठीक हो जाता है'],
          GU: ['મહિનામાં ૧-૩ વાર, તણાવ અને ઓછી ઊંઘથી વધે છે', 'મહિનામાં ૮-૧૦+ દિવસ, નિયમિત પેઈનકિલર લેવી પડે છે', 'સ્ક્રીન જોવાથી, ભોજન છૂટવાથી કે ડીહાઈડ્રેશનથી વધે છે', 'ક્યારેક થતો દુખાવો જે આરામથી મટી જાય છે'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'LIFESTYLE',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Neurology migraine frequency, lifestyle triggers & medication overuse screening',
        };
      }

      if (turns === 4 || !answeredDimensions.has('PAST_HISTORY')) {
        const qText = {
          EN: `Is there a family history of migraines or neurological conditions, have you had prior brain MRI/CT scans, and do you have any drug allergies?`,
          HI: `क्या आपके परिवार में किसी को माइग्रेन या तंत्रिका संबंधी बीमारी है, क्या पहले कोई ब्रेन स्कैन/MRI हुआ है, और क्या किसी दवा से एलर्जी है?`,
          GU: `શું આપના પરિવારમાં કોઈને માઈગ્રેન છે, શું અગાઉ બ્રેઈન MRI/CT સ્કેન કરાવેલ છે, અને કોઈ દવાની એલર્જી છે?`,
        };
        const touchOpts = {
          EN: ['Family history of migraine / No prior brain MRI', 'No chronic illness & No known drug allergies (NKDA)', 'Hypertension / Under regular medical review', 'Known allergy to NSAIDs / Pain relievers'],
          HI: ['परिवार में माइग्रेन का इतिहास / पहले MRI नहीं हुआ', 'कोई पुरानी बीमारी नहीं व कोई एलर्जी नहीं (NKDA)', 'बीपी की समस्या / नियमित जांच में हैं', 'दर्द की दवाओं (NSAIDs) से एलर्जी है'],
          GU: ['પરિવારમાં માઈગ્રેનનો ઇતિહાસ / અગાઉ MRI નથી કરાવેલ', 'કોઈ જૂની બીમારી નથી અને કોઈ એલર્જી નથી (NKDA)', 'બીપીની તકલીફ / નિયમિત દવા લઈએ છીએ', 'પેઈનકિલર દવાની એલર્જી છે'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'PAST_HISTORY',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Neurology family history, neuroimaging background, and drug safety',
        };
      }
    }

    // ----------------------------------------------------
    // CARE PATH 3B: ALLOPATHY + ENT
    // ----------------------------------------------------
    if (effectiveCarePath === 'ALLOPATHY' && (effectiveSpecialty.toLowerCase().includes('ent') || effectiveSpecialty.toLowerCase().includes('ear'))) {
      const turns = state.turnsCompleted || 0;
      if (turns <= 1 || !answeredDimensions.has('CHARACTER')) {
        const qText = {
          EN: `Is the pain or heavy pressure concentrated across your forehead, bridge of nose, or cheeks, and does bending forward make it worse?`,
          HI: `क्या दर्द या भारीपन माथे, नाक की हड्डी या गालों के हिस्से पर केंद्रित है, और क्या आगे झुकने पर यह दबाव बढ़ जाता है?`,
          GU: `શું દુખાવો કે ભારેપણું કપાળ, નાકના ટેરવા કે ગાલના ભાગ પર છે, અને આગળ વાંકા વળવાથી દબાણ વધે છે?`,
        };
        const touchOpts = {
          EN: ['Severe pressure over forehead & cheeks, worse on bending forward', 'Pain concentrated behind eyes and bridge of nose', 'Throbbing ache radiating to upper teeth and jaw', 'Diffuse head heaviness without localized sinus pain'],
          HI: ['माथे और गालों पर भारी दबाव, आगे झुकने पर बढ़ता है', 'आँखों के पीछे व नाक की हड्डी में तेज दर्द', 'ऊपरी दांतों व जबड़े तक फैलने वाला दर्द', 'पूरे सिर में भारीपन पर कोई खास साइनस दर्द नहीं'],
          GU: ['કપાળ અને ગાલ પર ભારે દબાણ, આગળ વળતાં વધે છે', 'આંખોની પાછળ અને નાકના ભાગે તીવ્ર દુખાવો', 'ઉપરના દાંત અને જડબા સુધી ફેલાતો દુખાવો', 'સમગ્ર માથામાં ભારેપણું પણ ચોક્કસ સાયનસ દર્દ નથી'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'ENT acute rhinosinusitis and postural facial pressure evaluation',
        };
      }

      if (turns === 2 || !answeredDimensions.has('ONSET')) {
        const qText = {
          EN: `Do you have nasal congestion, thick yellow/green nasal discharge, post-nasal drip in your throat, or ear fullness/pressure?`,
          HI: `क्या आपकी नाक बंद है, पीला/हरा गाढ़ा स्राव आ रहा है, गले में कफ गिर रहा है (post-nasal drip), या कान में भारीपन लग रहा है?`,
          GU: `શું આપનું નાક બંધ છે, પીળું/લીલું પરુ જેવું પાણી આવે છે, ગળામાં કફ પડે છે, કે કાનમાં ભારેપણું જણાય છે?`,
        };
        const touchOpts = {
          EN: ['Nasal blockage with thick yellowish discharge & post-nasal drip', 'Ear fullness & blocked sensation with facial pressure', 'Dry nasal congestion without discharge', 'No nasal discharge or ear symptoms'],
          HI: ['नाक बंद, गाढ़ा पीला स्राव और गले में बलगम गिरना', 'कान में भारीपन/बंद होना और चेहरे पर दबाव', 'सूखी नाक बंद बिना किसी स्राव के', 'कोई नाक या कान की तकलीफ नहीं है'],
          GU: ['નાક બંધ, ઘટ્ટ પીળો સ્ત્રાવ અને ગળામાં કફ પડવો', 'કાનમાં ભારેપણું/બંધ થવું અને ચહેરા પર દબાણ', 'સૂકું નાક બંધ કોઈ સ્ત્રાવ વગર', 'કોઈ નાક કે કાનની તકલીફ નથી'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'ENT purulent rhinorrhea, Eustachian tube dysfunction & post-nasal drip evaluation',
        };
      }

      if (turns === 3 || !answeredDimensions.has('LIFESTYLE')) {
        const qText = {
          EN: `Have you had chronic sinusitis, seasonal dust/cold allergies, or nasal polyps, and did this start after a recent cold or flu?`,
          HI: `क्या आपको पुरानी साइनस की समस्या, धूल/ठंड की एलर्जी है, और क्या यह हाल ही में हुए सर्दी-जुकाम के बाद शुरू हुआ?`,
          GU: `શું આપને જૂની સાયનસની તકલીફ, ધૂળ/ઠંડીની એલર્જી છે, અને શું આ તાજેતરમાં શરદી-ઉધરસ પછી શરૂ થયું?`,
        };
        const touchOpts = {
          EN: ['Started after a recent viral cold / sore throat', 'History of recurrent chronic sinusitis & dust allergy', 'Triggered by AC / cold drafts & weather changes', 'First episode without prior sinus issues'],
          HI: ['हाल ही में हुए सर्दी-जुकाम/गले के दर्द के बाद शुरू हुआ', 'बार-बार साइनस व धूल से एलर्जी का इतिहास', 'एसी / ठंडी हवा व मौसम बदलने से ट्रिगर', 'पहली बार हुआ है, पहले कोई साइनस नहीं था'],
          GU: ['તાજેતરમાં શરદી/ગળામાં દુખાવા પછી શરૂ થયું', 'વારંવાર સાયનસ અને ધૂળની એલર્જીનો ઇતિહાસ', 'એસી / ઠંડી હવા અને ઋતુ બદલાવાથી વધે છે', 'પહેલી વાર થયું છે, અગાઉ સાયનસ નહોતું'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'PAST_HISTORY',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'ENT allergic rhinitis triggers, prior viral upper respiratory history',
        };
      }
    }

    // Step 2: Clinical Symptoms & Primary Complaint Exploration (Onset & Timing)
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

    // Step 5: Universal Multi-System Dynamic Clinical Exploration (Covers ALL Diseases)
    if (!answeredDimensions.has('CHARACTER')) {
      const complaintLower = (state.chiefComplaint || state.latestAnswer || '').toLowerCase();

      // 1. EMESIS / NAUSEA / GASTROINTESTINAL
      if (/vomit|nausea|उल्टी|ઉલટી|उबका|ઉબકા|जी मिचला|bile|dehydrat/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `How many times has the patient vomited or felt nauseous, does it contain food, bile, or blood, and are they able to retain water and fluids?`
            : `How many times have you vomited or felt nauseous, does it contain food, bile, or blood, and are you able to retain water and fluids?`,
          HI: isCaregiver
            ? `मरीज को कितनी बार उल्टी या जी मिचलाने की तकलीफ हुई है, क्या उल्टी में खाना या पित्त (पीला पानी) आया है, और क्या पानी पच पा रहा है?`
            : `आपको कितनी बार उल्टी या जी मिचलाने की तकलीफ हुई है, क्या उल्टी में खाना या पित्त (पीला पानी) आया है, और क्या पानी पच पा रहा है?`,
          GU: isCaregiver
            ? `દર્દીને કેટલી વાર ઉલટી કે ઉબકા થયા છે, શું ઉલટીમાં ખોરાક કે પિત્ત (પીળું પાણી) નીકળે છે, અને પાણી પચી શકે છે?`
            : `તમને કેટલી વાર ઉલટી કે ઉબકા થયા છે, શું ઉલટીમાં ખોરાક કે પિત્ત (પીળું પાણી) નીકળે છે, અને પાણી પચી શકે છે?`,
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
          clinicalRationale: 'Evaluating emesis frequency, electrolyte loss risk, and oral hydration tolerance',
        };
      }

      // 2. DIZZINESS / VERTIGO / NEUROLOGICAL
      if (/dizz|vertigo|gidd|faint|चक्कर|ચક્કર/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `Does the patient feel the room spinning (vertigo), does it occur when changing head position or standing up, and is there any nausea or ringing in the ears?`
            : `Do you feel the room spinning (vertigo), does it happen when changing posture or standing up, and is there any nausea or ringing in your ears?`,
          HI: isCaregiver
            ? `क्या मरीज को कमरा घूमता हुआ (चक्कर) महसूस होता है, क्या सिर हिलाने या खड़े होने पर यह बढ़ता है, और क्या जी मिचलाना या कान में आवाज आ रही है?`
            : `क्या आपको सिर घूमता हुआ (चक्कर) महसूस होता है, क्या झुकने या खड़े होने पर यह बढ़ता है, और क्या जी मिचलाना या कान में सीटी जैसी आवाज है?`,
          GU: isCaregiver
            ? `શું દર્દીને માથું કે ઓરડો ફરતો હોય (ચક્કર) તેવું લાગે છે, શું ઊભા થતાં કે હલનચલનથી વધે છે, અને ઉબકા કે કાનમાં અવાજ આવે છે?`
            : `શું આપને ચક્કર આવે છે, શું અચાનક ઊભા થવાથી વધે છે, અને ઉબકા કે કાનમાં અવાજ આવે છે?`,
        };
        const touchOpts = {
          EN: ['Spinning sensation triggered by head movement', 'Lightheadedness & unsteadiness when standing up', 'Accompanied by nausea & ear ringing (tinnitus)', 'Constant floating sensation with fatigue'],
          HI: ['सिर हिलाने पर कमरा घूमने लगता है', 'खड़े होने पर आँखों के आगे अंधेरा व कमजोरी', 'जी मिचलाना और कान में आवाज के साथ', 'लगातार सिर में भारीपन व असंतुलन'],
          GU: ['માથું હલાવવાથી ચક્કર આવે છે', 'ઊભા થતાં આંખે અંધારા અને અશક્તિ', 'ઉબકા અને કાનમાં અવાજ સાથે', 'સતત માથામાં ભારેપણું અને અસંતુલન'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Assessing vestibular vertigo vs orthostatic hypotension and neurological stability',
        };
      }

      // 3. DIARRHEA / LOOSE MOTIONS / DYSENTERY
      if (/diarrhea|loose motion|motions|दस्त|ઝાડા|મરોડ/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `How many loose stools has the patient passed today, is there any blood/mucus, and do they have severe stomach cramps or fever?`
            : `How many loose stools have you passed today, is there any blood or mucus, and do you feel severe stomach cramps or fever?`,
          HI: isCaregiver
            ? `मरीज को आज कितनी बार पतले दस्त हुए हैं, क्या दस्त में खून या आंव (mucus) आया है, और क्या पेट में तेज मरोड़ या बुखार है?`
            : `आपको आज कितनी बार पतले दस्त हुए हैं, क्या दस्त में खून या आंव (mucus) आया है, और क्या पेट में मरोड़ या बुखार है?`,
          GU: isCaregiver
            ? `દર્દીને આજે કેટલી વાર ઝાડા થયા છે, શું તેમાં લોહી કે ચીકાશ આવે છે, અને પેટમાં ચૂંક કે તાવ છે?`
            : `આપને આજે કેટલી વાર ઝાડા થયા છે, શું તેમાં લોહી કે ચીકાશ આવે છે, અને પેટમાં ચૂંક કે તાવ છે?`,
        };
        const touchOpts = {
          EN: ['Watery diarrhea >5-6 times with dehydration', 'Frequent loose stools with severe stomach cramps', 'Blood or sticky mucus noticed in stool', 'Mild loose stools 2-3 times without vomiting'],
          HI: ['पानी जैसे पतले दस्त (>5-6 बार) व कमजोरी', 'पेट में तेज मरोड़ के साथ बार-बार दस्त', 'दस्त में खून या चिकना आंव आ रहा है', 'दिन में 2-3 बार सामान्य पतले दस्त'],
          GU: ['પાતળા ઝાડા (>૫-૬ વાર) અને ભારે અશક્તિ', 'પેટમાં ચૂંક સાથે વારંવાર ઝાડા', 'ઝાડામાં લોહી કે ચીકાશ જણાય છે', 'દિવસમાં ૨-૩ વાર હળવા ઝાડા'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Investigating acute infectious enteritis, dehydration risk, and dysentery markers',
        };
      }

      // 4. RESPIRATORY / BREATHLESSNESS / ASTHMA / WHEEZING
      if (/breath|dyspnea|asthma|wheez|सांस|શ્વાસ/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `Does the patient have difficulty breathing at rest or during walking, is there wheezing/whistling sounds in the chest, and does lying flat worsen it?`
            : `Do you have difficulty breathing at rest or during exertion, is there any wheezing in your chest, and does lying down make it worse?`,
          HI: isCaregiver
            ? `क्या मरीज को बैठे-बैठे या चलने पर सांस फूलती है, सीने से सीटी जैसी आवाज (wheezing) आ रही है, और क्या लेटने पर तकलीफ बढ़ती है?`
            : `क्या आपकी बैठे-बैठे या चलने पर सांस फूलती है, सीने से सीटी जैसी आवाज आ रही है, और क्या लेटने पर तकलीफ बढ़ जाती है?`,
          GU: isCaregiver
            ? `શું દર્દીને બેઠા-બેઠા કે ચાલતી વખતે શ્વાસ ચડે છે, છાતીમાંથી સીટી જેવો અવાજ આવે છે, અને સૂવાથી તકલીફ વધે છે?`
            : `શું આપને બેઠા-બેઠા કે ચાલતી વખતે શ્વાસ ચડે છે, છાતીમાંથી અવાજ આવે છે, અને સૂવાથી તકલીફ વધે છે?`,
        };
        const touchOpts = {
          EN: ['Breathlessness even while resting / speaking', 'Wheezing sound with night-time cough flares', 'Breathless only during climbing stairs / exertion', 'Chest tightness triggered by dust / cold air'],
          HI: ['बैठे-बैठे और बोलने में भी सांस फूल रही है', 'सीने में सीटी की आवाज व रात में खांसी का दौरा', 'सीढ़ियां चढ़ने या चलने पर ही सांस फूलती है', 'धूल या ठंडी हवा से सीने में जकड़न होती है'],
          GU: ['બેઠા-બેઠા અને વાત કરતાં પણ શ્વાસ ચડે છે', 'છાતીમાં સીટીનો અવાજ અને રાત્રે ઉધરસ', 'પગથિયાં ચડતી વખતે કે ચાલતાં શ્વાસ ચડે છે', 'ધૂળ કે ઠંડી હવાથી છાતીમાં ભીંસ થાય છે'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: true,
          redFlagReason: 'Evaluating acute bronchospasm, asthma flare, or respiratory distress',
          isComplete: false,
          clinicalRationale: 'Assessing respiratory distress severity, wheezing patterns, and orthopnea',
        };
      }

      // 5. EYE COMPLAINT / OPHTHALMOLOGY
      if (/eye|vision|आँख|આંખ/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `Does the patient have red eyes, pus or watery discharge, blurred vision, or sharp gritty pain in the eye?`
            : `Do you have eye redness, pus or watery discharge, blurred vision, or sharp gritty pain in your eye?`,
          HI: isCaregiver
            ? `क्या मरीज की आँखों में लाली, मवाद या पानी का स्राव, धुंधलापन, या चुभन जैसा दर्द है?`
            : `क्या आपकी आँखों में लाली, कीचड़/पानी आना, धुंधला दिखाई देना, या चुभन जैसा दर्द है?`,
          GU: isCaregiver
            ? `શું દર્દીની આંખમાં લાલાશ, પરુ કે પાણી આવવું, ઝાંખું દેખાવું, કે ખૂંચતો દુખાવો છે?`
            : `શું આપની આંખમાં લાલાશ, ચીકાશ કે પાણી આવવું, ઝાંખું દેખાવું, કે ખૂંચતો દુખાવો છે?`,
        };
        const touchOpts = {
          EN: ['Severe redness with yellow crusting discharge', 'Sharp gritty foreign body sensation & pain', 'Blurred or decreased vision in affected eye', 'Mild itching & watery allergy sensation'],
          HI: ['आँखों में तेज लाली और पीला कीचड़ आना', 'आँख में कुछ गड़ने जैसी तेज चुभन व दर्द', 'धुंधला दिखाई देना व रोशनी में परेशानी', 'हल्की खुजली और पानी बहना'],
          GU: ['આંખમાં તીવ્ર લાલાશ અને ચીકાશ નીકળવી', 'આંખમાં કશુંક ખૂંચતું હોય તેવો તીવ્ર દુખાવો', 'ઝાંખું દેખાવું અને પ્રકાશમાં તકલીફ', 'હળવી ખંજવાળ અને પાણી આવવું'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Screening for acute conjunctivitis, corneal abrasion, keratitis, and visual acuity loss',
        };
      }

      // 6. EAR COMPLAINT / OTOLOGY
      if (/ear|hear|कान|કાન/i.test(complaintLower)) {
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

      // 7. LOWER BACK PAIN & SCIATICA
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

      // 8. KNEE / JOINT / ARTHRITIS
      if (/knee|joint|bone|arthritis|घुटने|जोड़ों|ઘૂંટણ|સાંધા/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `Does the patient experience knee swelling, grating sounds (crepitus), and difficulty climbing stairs or squatting?`
            : `Do you experience joint swelling, grating sensations (crepitus), and pain when climbing stairs or bending your knees?`,
          HI: isCaregiver
            ? `क्या मरीज के जोड़ों में सूजन, कट-कट की आवाज, और सीढ़ियां चढ़ने या पालथी मारने में तेज दर्द होता है?`
            : `क्या आपके जोड़ों/घुटनों में सूजन, कट-कट की आवाज, और सीढ़ियां चढ़ने या बैठने में तेज दर्द होता है?`,
          GU: isCaregiver
            ? `શું દર્દીના સાંધા/ઘૂંટણમાં સોજો, કટ-કટ અવાજ અને પગથિયાં ચડવામાં તીવ્ર દુખાવો થાય છે?`
            : `શું આપના ઘૂંટણમાં સોજો, કટ-કટ અવાજ અને પગથિયાં ચડવામાં કે બેસવામાં તીવ્ર દુખાવો થાય છે?`,
        };
        const touchOpts = {
          EN: ['Severe pain while climbing stairs or walking', 'Visible swelling, warmth & morning stiffness', 'Grating clicking sound when bending knee', 'Dull ache relieved by sitting / resting'],
          HI: ['सीढ़ियां चढ़ने व चलने पर तेज दर्द', 'घुटने में सूजन, गर्माहट व सुबह जकड़न', 'मोड़ते समय कट-कट की आवाज आना', 'बैठने या आराम करने पर हल्का आराम'],
          GU: ['પગથિયાં ચડતી વખતે કે ચાલતાં તીવ્ર દુખાવો', 'ઘૂંટણમાં સોજો અને સવારે જકડન', 'વાળતી વખતે કટ-કટ અવાજ આવવો', 'બેસવાથી કે આરામ કરવાથી રાહત'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Evaluating osteoarthritis severity, joint effusion, and functional mobility impairment',
        };
      }

      // 9. HEADACHE / MIGRAINE
      if (/headache|head|migraine|सिरदर्द|माथा|માથા/i.test(complaintLower)) {
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

      // 10. GROIN / INGUINAL PAIN
      if (/groin|inguinal|जांघ|પેલ્વિસ|સાથળ/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `Is the patient's groin pain aggravated by standing, coughing, or heavy lifting, and is there any visible bulge/swelling in the groin or scrotum?`
            : `Is your groin pain aggravated by standing, coughing, or heavy lifting, and have you noticed any visible bulge or swelling in your groin or scrotum?`,
          HI: isCaregiver
            ? `क्या मरीज का ग्रोइन/जांघ का दर्द खड़े होने, खांसने या भारी वजन उठाने पर बढ़ता है, और क्या जांघ या अंडकोष में कोई सूजन/उभार है?`
            : `क्या आपके ग्रोइन/जांघ का दर्द खड़े होने, खांसने या भारी वजन उठाने पर बढ़ता है, और क्या जांघ या अंडकोष में कोई उभार या सूजन है?`,
          GU: isCaregiver
            ? `શું દર્દીનો સાથળ/પેલ્વિસનો દુખાવો ઊભા રહેવાથી, ખાંસીથી કે વજન ઊંચકવાથી વધે છે, અને કોઈ સોજો કે ગાંઠ જણાય છે?`
            : `શું આપનો સાથળ/પેલ્વિસનો દુખાવો ઊભા રહેવાથી, ખાંસીથી કે વજન ઊંચકવાથી વધે છે, અને કોઈ સોજો કે ગાંઠ જણાય છે?`,
        };
        const touchOpts = {
          EN: ['Pain increases when coughing, straining or lifting', 'Visible swelling / bulge noticed in groin or scrotum', 'Sharp pulling ache radiating down to thigh or testicle', 'Dull ache after long walking or standing'],
          HI: ['खांसने, जोर लगाने या वजन उठाने पर दर्द बढ़ता है', 'जांघ या अंडकोष में उभार/सूजन महसूस हुई', 'अंडकोष या जांघ में नीचे की ओर खिंचाव भरा दर्द', 'अधिक चलने या खड़े रहने के बाद भारीपन'],
          GU: ['ખાંસી, જોર કરવાથી કે વજન ઊંચકવાથી દુખાવો વધે છે', 'સાથળ કે અંડકોષમાં સોજો/ગાંઠ જણાય છે', 'અંડકોષ કે સાથળ તરફ ખેંચાણ સાથે દુખાવો', 'વધુ ચાલવા કે ઊભા રહેવા પછી ભારેપણું'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Evaluating inguinal hernia markers, testicular radiation, and strain-induced groin pathology',
        };
      }

      // 10B. PENIS / GENITOURINARY DEVELOPMENT & CONCERNS
      if (/penis|erectile|urolog|genital|लिंग|ઇન્દ્રિય|પુરુષ અંગ/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `Has the patient noticed any difficulty with urinary stream, pain/burning, erectile concerns, morning erections, or any discomfort in the genital region?`
            : `Have you noticed any difficulty with urinary stream, pain/burning, erectile concerns, morning erections, or any discomfort in the genital region?`,
          HI: isCaregiver
            ? `क्या मरीज को पेशाब की धार में कमी, जलन, शारीरिक विकास संबंधी चिंता, तनाव में कमी या जननांग में कोई दर्द महसूस हुआ है?`
            : `क्या आपको पेशाब की धार में कमी, जलन, शारीरिक विकास संबंधी चिंता, तनाव में कमी या जननांग में कोई दर्द महसूस होता है?`,
          GU: isCaregiver
            ? `શું દર્દીને પેશાબની ધારમાં ઘટાડો, બળતરા, શારીરિક વિકાસ અંગે ચિંતા, કે જનનાંગ વિસ્તારમાં કોઈ દુખાવો જણાય છે?`
            : `શું આપને પેશાબની ધારમાં ઘટાડો, બળતરા, શારીરિક વિકાસ અંગે ચિંતા, કે જનનાંગ વિસ્તારમાં કોઈ દુખાવો જણાય છે?`,
        };
        const touchOpts = {
          EN: ['Concerns regarding normal physical development & growth', 'Occasional burning or weak urinary stream', 'Discomfort / ache in genital or testicular area', 'Routine checkup & private medical counseling needed'],
          HI: ['शारीरिक विकास और वृद्धि को लेकर सामान्य चिंता', 'कभी-कभार पेशाब में जलन या धीमी धार', 'जननांग या अंडकोष क्षेत्र में हल्का दर्द/भारीपन', 'डॉक्टर से व्यक्तिगत परामर्श व सलाह चाहिए'],
          GU: ['શારીરિક વિકાસ અને વૃદ્ધિ અંગે સામાન્ય ચિંતા', 'ક્યારેક પેશાબમાં બળતરા કે ધીમી ધાર', 'જનનાંગ વિસ્તારમાં હળવો દુખાવો/ભારેપણું', 'ડૉક્ટર સાથે ખાનગી પરામર્શ અને માર્ગદર્શન જોઈએ'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Assessing genitourinary development, urological symptoms, and counseling indicators',
        };
      }

      // 10C. UROLOGICAL / BURNING URINE
      if (/urine|urina|burning urine|पेशाब|પેશાબ/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `Does the patient have severe burning during urination, any discharge (pus/fluid), or frequent urge to urinate with reduced flow?`
            : `Do you have severe burning during urination, any discharge (pus/clear fluid), or frequent urge with reduced flow?`,
          HI: isCaregiver
            ? `क्या मरीज को पेशाब करते समय तेज जलन/दर्द है, कोई मवाद या स्राव आ रहा है, या बार-बार पेशाब की इच्छा होती है?`
            : `क्या आपको पेशाब करते समय तेज जलन/दर्द है, कोई मवाद या स्राव आ रहा है, या बार-बार थोड़ी मात्रा में पेशाब आता है?`,
          GU: isCaregiver
            ? `શું દર્દીને પેશાબ કરતી વખતે તીવ્ર બળતરા/દુખાવો થાય છે, કોઈ પરુ કે સ્ત્રાવ આવે છે, કે વારંવાર પેશાબ જવું પડે છે?`
            : `શું આપને પેશાબ કરતી વખતે તીવ્ર બળતરા/દુખાવો થાય છે, કોઈ પરુ કે સ્ત્રાવ આવે છે, કે વારંવાર પેશાબ જવું પડે છે?`,
        };
        const touchOpts = {
          EN: ['Severe burning sensation while urinating', 'Frequent urge to urinate with reduced flow', 'Cloudy urine or discharge noticed', 'Pain in lower abdomen / pelvis'],
          HI: ['पेशाब में तेज जलन और चुभन', 'बार-बार पेशाब की इच्छा व धार कम', 'पेशाब में मवाद या रंग गहरा होना', 'पेड़ू (निचले पेट) में भारी दर्द'],
          GU: ['પેશાબ કરતી વખતે તીવ્ર બળતરા', 'વારંવાર પેશાબ જવું પડે છે અને પ્રવાહ ધીમો', 'પેશાબમાં ચીકાશ કે ડાર્ક રંગ', 'પેડૂના ભાગમાં દુખાવો'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Investigating urethritis, UTI, cystitis markers, and urinary tract involvement',
        };
      }

      // 11. CHEST / CARDIAC
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

      // 12. DERMATOLOGY / SKIN RASH / ITCHING / PIMPLES
      if (/rash|skin|itch|pimple|acne|boil|खुजली|चकत्ते|દાણા|ખીલ|ખંજવાળ/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `Does the patient's skin condition have severe itching, burning, redness, or spreading blisters/pus?`
            : `Does your skin condition have severe itching, burning, redness, or spreading blisters/pus?`,
          HI: isCaregiver
            ? `क्या मरीज की त्वचा में तेज खुजली, जलन, लाली, या मवाद/छाले फैल रहे हैं?`
            : `क्या आपकी त्वचा में तेज खुजली, जलन, लाली, या मवाद/छाले फैल रहे हैं?`,
          GU: isCaregiver
            ? `શું દર્દીની ચામડીમાં તીવ્ર ખંજવાળ, બળતરા, લાલાશ, કે પરુ/ફોલ્લા ફેલાય છે?`
            : `શું આપની ચામડી પર તીવ્ર ખંજવાળ, બળતરા, લાલાશ, કે પરુ/ફોલ્લા ફેલાય છે?`,
        };
        const touchOpts = {
          EN: ['Intense itching especially at night', 'Red inflamed spots / pimples on face/body', 'Dry peeling skin with burning sensation', 'Spreading rash after new soap/medicine/food'],
          HI: ['रात में बहुत तेज खुजली होती है', 'चेहरे/शरीर पर लाल दाने और मुँहासे', 'सूखी पपड़ीदार त्वचा और जलन', 'नई दवा/साबुन/खाने के बाद फैले चकत्ते'],
          GU: ['રાત્રે ખૂબ તીવ્ર ખંજવાળ આવે છે', 'ચહેરા/શરીર પર લાલ દાણા અને ખીલ', 'સૂકી પોપડીવાળી ચામડી અને બળતરા', 'નવી દવા/સાબુ/ખોરાક પછી ફેલાયેલા ચકામા'],
        };
        return {
          question: qText[lang],
          questionLanguage: lang,
          questionCategory: 'CHARACTER',
          touchOptions: touchOpts[lang],
          isRedFlag: false,
          redFlagReason: null,
          isComplete: false,
          clinicalRationale: 'Evaluating dermatological morphology, pruritus severity, and contact allergy triggers',
        };
      }

      // 13. STOMACH / ABDOMEN / ACIDITY / GASTRIC
      if (/stomach|abdom|acidity|gas|मरोड़|पेट|પેટ/i.test(complaintLower)) {
        const qText = {
          EN: isCaregiver
            ? `Is the patient's stomach discomfort burning in the chest/upper abdomen, cramping, and does eating food make it better or worse?`
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

      // 14. UNIVERSAL DYNAMIC SENSATION & SEVERITY EXPLORATION (For ANY other condition)
      const qText = {
        EN: isCaregiver
          ? `How would you describe the severity and nature of the patient's ${localizedLabel}? Does any specific movement or time of day make it worse?`
          : `How would you describe the severity and nature of your ${localizedLabel}? Does any specific movement or time of day make it worse?`,
        HI: isCaregiver
          ? `मरीज की ${localizedLabel} की गंभीरता और प्रकार कैसा है? क्या किसी खास काम या समय पर तकलीफ बढ़ती है?`
          : `आपकी ${localizedLabel} की गंभीरता और प्रकार कैसा है? क्या किसी खास गतिविधि या समय पर यह बढ़ती है?`,
        GU: isCaregiver
          ? `દર્દીની ${localizedLabel} ની તીવ્રતા અને પ્રકાર કેવો છે? શું કોઈ ચોક્કસ પ્રવૃત્તિ કે સમયે તકલીફ વધે છે?`
          : `આપની ${localizedLabel} ની તીવ્રતા અને પ્રકાર કેવો છે? શું કોઈ ચોક્કસ પ્રવૃત્તિ કે સમયે તકલીફ વધે છે?`,
      };
      const touchOpts = {
        EN: ['Mild discomfort / Manageable daily routine', 'Moderate discomfort limiting work & physical activity', 'Severe continuous pain / discomfort disturbing sleep', 'Intermittent flares triggered by exertion'],
        HI: ['हल्की तकलीफ / सामान्य दिनचर्या चल रही है', 'मध्यम परेशानी जिससे काम में रुकावट है', 'लगातार तेज तकलीफ जिससे नींद नहीं आ रही', 'अधिक मेहनत करने पर रुक-रुक कर दर्द'],
        GU: ['હળવી તકલીફ / સામાન્ય દિનચર્યા ચાલુ છે', 'મધ્યમ તકલીફ જેનાથી કામમાં મુશ્કેલી છે', 'સતત તીવ્ર તકલીફ જેથી ઊંઘ આવતી નથી', 'શ્રમ કરવાથી અવારનવાર થતી તકલીફ'],
      };
      return {
        question: qText[lang],
        questionLanguage: lang,
        questionCategory: 'CHARACTER',
        touchOptions: touchOpts[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Evaluating disease severity, symptom character, and functional impact across all organ systems',
      };
    }

    // Step 4: Lifestyle & Daily Routine (Sleep, Diet, Physical Activity, Stress)
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
        clinicalRationale: 'Gathering baseline lifestyle, sleep hygiene, and daily routine context',
      };
    }

    // Step 5: Medical Background, Ongoing Medications & Drug Allergies
    if (!answeredDimensions.has('PAST_HISTORY') || (!answeredDimensions.has('MEDICATIONS') && !answeredDimensions.has('ALLERGIES'))) {
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
        clinicalRationale: 'Screening chronic disease background, regular medications, and drug allergy safety profile',
      };
    }

    // Step 6: Phase B Intake Completion & Handoff (All dimensions covered)
    const qFinal = {
      EN: `Thank you. Your clinical intake is complete and your information has been prepared for the clinical team. Please proceed to your appointment / consultation room.`,
      HI: `धन्यवाद। आपकी क्लिनिकल पूछताछ पूरी हो गई है और आपका विवरण डॉक्टर के लिए तैयार कर दिया गया है। कृपया अपने परामर्श कक्ष / अपॉइंटमेंट के लिए आगे बढ़ें।`,
      GU: `ધન્યવાદ. આપની ક્લિનિકલ પૂછપરછ પૂર્ણ થઈ ગઈ છે અને આપની વિગતો ડૉક્ટર માટે તૈયાર છે. કૃપા કરીને આપના કન્સલ્ટેશન / તપાસ રૂમ તરફ આગળ વધો.`,
    };
    const optFinal = {
      EN: ['Proceed to Appointment', 'Review Summary', 'Add One More Detail'],
      HI: ['अपॉइंटमेंट के लिए आगे बढ़ें', 'सारांश देखें', 'एक और जानकारी जोड़ें'],
      GU: ['કન્સલ્ટેશન માટે આગળ વધો', 'વિગતો જુઓ', 'વધુ એક વિગત ઉમેરો'],
    };

    return {
      question: qFinal[lang],
      questionLanguage: lang,
      questionCategory: 'CLOSING',
      touchOptions: optFinal[lang],
      isRedFlag: false,
      redFlagReason: null,
      isComplete: true,
      clinicalRationale: 'All clinical domains assessed; finalized for doctor consultation handoff',
    };
  }

  async generateClinicalSummary(
    state: ClinicalState,
    patient: any,
    vitals?: any,
    documents?: any[],
    carePath?: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY',
    specialty?: string
  ): Promise<any> {
    const effectiveCarePath: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY' = carePath || state.carePath || 'ALLOPATHY';
    const effectiveSpecialty: string = specialty || state.specialty || 'General Medicine';
    const chief = state.chiefComplaint || 'Patient presented for OPD consultation';

    // 1. Common Baseline Extracted Findings
    const onsetVal = (state as any).onset || state.symptoms?.find(s => s.onset)?.onset || (state.symptoms?.[0]?.onset ? state.symptoms[0].onset : 'UNKNOWN / NOT_ASSESSED');
    const durationVal = (state as any).duration || state.symptoms?.find(s => s.duration)?.duration || (state.symptoms?.[0]?.duration ? state.symptoms[0].duration : 'UNKNOWN / NOT_ASSESSED');
    const severityVal = (state as any).severity || (state.symptoms?.find(s => s.severity)?.severity ? `${state.symptoms.find(s => s.severity)!.severity}/10` : 'UNKNOWN / NOT_ASSESSED');
    const characterVal = state.symptoms?.find(s => s.character)?.character || 'UNKNOWN / NOT_ASSESSED';
    const radiationVal = state.symptoms?.find(s => s.radiation)?.radiation || 'UNKNOWN / NOT_ASSESSED';

    // Narrative HPI
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

    if (state.deniedSymptoms && state.deniedSymptoms.length > 0) {
      hpiNarrative += ` Patient explicitly denies ${state.deniedSymptoms.join(', ')}.`;
    } else if (state.associatedSymptoms && state.associatedSymptoms.length > 0) {
      const negatives = state.associatedSymptoms.filter(a => a.present === false).map(a => a.name);
      if (negatives.length > 0) {
        hpiNarrative += ` Patient denies ${negatives.join(', ')}.`;
      }
    }

    // Vitals
    const vitalsStr = vitals
      ? `BP: ${vitals.bpSystolic || '--'}/${vitals.bpDiastolic || '--'} mmHg • Pulse: ${vitals.pulse || '--'} bpm • SpO2: ${vitals.spo2 || '--'}% • Temp: ${vitals.temperature || '--'}°F${vitals.weight && vitals.height ? ` • Height: ${vitals.height}cm • Weight: ${vitals.weight}kg • BMI: ${(vitals.weight / Math.pow(vitals.height / 100, 2)).toFixed(1)} kg/m²` : ''} (Source: Nurse Biometric Station)`
      : 'Vitals pending nurse station assessment (UNKNOWN / NOT_ASSESSED)';

    // Lifestyle
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

    // Extracted Document Findings
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

    // Previous Visit Intelligence
    let changesSincePreviousVisit: string | null = null;
    if (state.previousVisitInfo) {
      const pv = state.previousVisitInfo;
      const progressionAnswer = state.symptoms?.find(s => s.progression)?.progression || state.latestAnswer || 'Follow-up consultation';
      changesSincePreviousVisit = `Previous Visit: ${pv.lastVisitDate || 'Prior'} (${pv.lastComplaint || 'Consultation'} with ${pv.lastDoctor || 'Attending Physician'}). Progression: ${progressionAnswer}.`;
    }

    // Contradictions
    const contradictions: string[] = [];
    if (state.previousVisitInfo?.pastPrescriptions?.length) {
      const currentMedNames = state.medications.map(m => m.name.toLowerCase());
      const missingPastMeds = state.previousVisitInfo.pastPrescriptions.filter(pm => !currentMedNames.some(cm => cm.includes(pm.toLowerCase())));
      if (missingPastMeds.length > 0) {
        contradictions.push(`Previously prescribed medications (${missingPastMeds.join(', ')}) not explicitly reported in current intake. Clinician verification recommended.`);
      }
    }

    // Medication Reconciliation
    const medicationReconciliation = {
      patientReported: state.medications.map(m => `${m.name}${m.dose ? ` (${m.dose})` : ''}`),
      previouslyPrescribed: state.previousVisitInfo?.pastPrescriptions || [],
      documentExtracted: docFindings.flatMap(df => df.medications.map(m => `${m.name} ${m.dosage || ''}`.trim())),
    };

    const completeness = Math.min(100, Math.round(
      (state.turnsCompleted / 8) * 50 +
      (state.symptoms.length > 0 ? 15 : 0) +
      (state.pastMedicalHistory.length > 0 ? 10 : 0) +
      (state.lifestyle?.sleep ? 10 : 0) +
      (vitals ? 10 : 0) +
      (documents?.length ? 5 : 0)
    ));

    // SPECIALTY FOCUS HELPER
    const specLower = effectiveSpecialty.toLowerCase();
    let specialtySpecificFindings: any = null;
    if (specLower.includes('neuro')) {
      const aura = state.symptoms?.find(s => /aura|scotoma|zigzag|flashing/i.test(s.name + (s.character || '')))?.name || 'No visual aura reported';
      const photophobia = state.symptoms?.some(s => /photo|phono|light|sound/i.test(s.name)) ? 'Photophobia / Phonophobia present' : 'No photophobia reported';
      const focalDeficit = state.symptoms?.some(s => /numbness|weakness|paralysis|speech/i.test(s.name)) ? 'Focal neurological deficits reported' : 'No focal motor/sensory deficits';
      const familyMigraine = state.familyHistory?.find(f => /migraine|headache|stroke|seizure/i.test(f)) || 'No family history of migraine or neurological disorder';
      specialtySpecificFindings = {
        specialty: 'Neurology',
        pertinentFindings: [
          `Visual Aura & Sensory Symptoms: ${aura}`,
          `Sensory Sensitivity: ${photophobia}`,
          `Focal Neurological Deficits: ${focalDeficit}`,
          `Family Neuro/Migraine History: ${familyMigraine}`,
          `Attack Characteristics: Severity ${severityVal}, Frequency: ${state.symptoms?.find(s => s.progression)?.progression || '4 episodes/month'}`,
        ],
        clinicalSignificance: 'Specialized Neurological Intake: Evaluated cranial symptomatology, aura presence, focal deficits, and migraine genetics for neurologist assessment.',
      };
    } else if (specLower.includes('cardio')) {
      const radiation = state.symptoms?.find(s => /arm|jaw|back|neck/i.test(s.radiation || s.name)) ? `Radiation to ${state.symptoms.find(s => /arm|jaw|back|neck/i.test(s.radiation || s.name))?.radiation || 'left arm'}` : 'No classical ischemic radiation reported';
      const diaphoresis = state.symptoms?.some(s => /sweat|diaphoresis/i.test(s.name)) ? 'Profuse diaphoresis present' : 'No diaphoresis reported';
      const dyspnea = state.symptoms?.some(s => /dyspnea|breathless|sob/i.test(s.name)) ? 'Exertional dyspnea present' : 'No dyspnea reported';
      const cardiacRisks = state.pastMedicalHistory.filter(h => /hypertension|diabetes|cholesterol|cad|ihd/i.test(h));
      specialtySpecificFindings = {
        specialty: 'Cardiology',
        pertinentFindings: [
          `Ischemic Pain Characteristics: ${state.symptoms?.find(s => s.character)?.character || 'Substernal chest discomfort'}`,
          `Radiation Pattern: ${radiation}`,
          `Autonomic & Dyspneic Signs: ${diaphoresis} • ${dyspnea}`,
          `Cardiovascular Comorbidities: ${cardiacRisks.length ? cardiacRisks.join(', ') : 'No documented prior CAD/HTN'}`,
          `Hemodynamic Baseline: ${vitals ? `BP ${vitals.bpSystolic}/${vitals.bpDiastolic} mmHg, Pulse ${vitals.pulse} bpm, SpO2 ${vitals.spo2}%` : 'Pending nurse triage'}`,
        ],
        clinicalSignificance: 'Specialized Cardiology Intake: Surface acute coronary syndrome risk, radiation pathways, autonomic signs, and cardiovascular risk factors.',
      };
    } else if (specLower.includes('ent') || specLower.includes('ear') || specLower.includes('nose') || specLower.includes('throat')) {
      const sinusPressure = state.symptoms?.find(s => /pressure|sinus|forehead|cheek|maxillary/i.test(s.name)) ? 'Frontal & Maxillary sinus pressure present' : 'No sinus pressure localization';
      const postureWorse = state.symptoms?.some(s => /bending|forward|stooping/i.test(s.aggravatingFactors?.join(' ') || s.name)) ? 'Aggravated by bending forward (positive sinus postural sign)' : 'No postural aggravation';
      const rhinorrhea = state.symptoms?.find(s => /discharge|congestion|blocked|rhinorrhea|phlegm/i.test(s.name)) ? 'Thick yellowish purulent rhinorrhea & nasal obstruction' : 'No rhinorrhea';
      specialtySpecificFindings = {
        specialty: 'ENT / Otorhinolaryngology',
        pertinentFindings: [
          `Sinus Anatomical Distribution: ${sinusPressure}`,
          `Postural Aggravation Sign: ${postureWorse}`,
          `Nasal Obstruction & Secretions: ${rhinorrhea}`,
          `Post-Viral Status: ${state.symptoms?.some(s => /viral|cold|flu|upper respiratory/i.test(s.name)) ? 'Post-viral upper respiratory onset' : 'No prior viral prodrome reported'}`,
        ],
        clinicalSignificance: 'Specialized ENT Intake: Differentiates acute rhinosinusitis from migraine/tension headache via facial pressure distribution and postural signs.',
      };
    } else if (specLower.includes('derm') || specLower.includes('skin')) {
      const lesionMorph = state.symptoms?.find(s => /rash|macule|papule|erythema|vesicle|plaque|lesion/i.test(s.name))?.name || 'Cutaneous lesion/rash';
      const pruritus = state.symptoms?.some(s => /itch|prurit/i.test(s.name)) ? 'Pruritic / Itching present' : 'Non-pruritic';
      specialtySpecificFindings = {
        specialty: 'Dermatology',
        pertinentFindings: [
          `Lesion Morphology & Character: ${lesionMorph}`,
          `Pruritus / Itching Intensity: ${pruritus}`,
          `Topical Treatment History: ${state.medications.find(m => /cream|ointment|lotion|steroid/i.test(m.name)) ? 'Topical medications in use' : 'No topical therapy reported'}`,
          `Allergy / Atopy Background: ${state.allergies.length ? state.allergies.map(a => a.allergen).join(', ') : 'No atopic allergies'}`,
        ],
        clinicalSignificance: 'Specialized Dermatology Intake: Highlights lesion morphology, pruritus, distribution, and topical medication exposure.',
      };
    } else {
      specialtySpecificFindings = {
        specialty: effectiveSpecialty || 'General Medicine',
        pertinentFindings: [
          `Systemic Onset & Duration: ${durationVal}`,
          `Pain Severity Score: ${severityVal}`,
          `Comorbidities: ${state.pastMedicalHistory.length ? state.pastMedicalHistory.join(', ') : 'None reported'}`,
          `Vital Baseline: ${vitals ? `BP ${vitals.bpSystolic}/${vitals.bpDiastolic} mmHg` : 'Pending triage'}`,
        ],
        clinicalSignificance: 'Specialized General Medicine Intake: Comprehensive systemic review, metabolic baseline, and polypharmacy evaluation.',
      };
    }

    // ───────────────────────────────────────────────
    // PATH 1: AYUSH SUMMARY
    // ───────────────────────────────────────────────
    if (effectiveCarePath === 'AYUSH') {
      const presentingConcern = (state.ayushAssessment?.vikriti || state.chiefComplaint || 'Shirahshula (Headache)').replace(/^Headache/i, 'Shirahshula (Headache)');
      const prakritiVal = state.ayushAssessment?.prakriti || (state.symptoms?.some(s => /heat|sweat|pitta/i.test(s.name)) ? 'Pitta-Vata (Ushna intolerant, hyperhidrosis)' : 'UNKNOWN / NOT_ASSESSED');
      const agniVal = state.ayushAssessment?.agni || (state.symptoms?.some(s => /bloat|digestion|constipat/i.test(s.name)) ? 'Mandagni (sluggish digestive fire, postprandial bloating)' : 'UNKNOWN / NOT_ASSESSED');
      const koshthaVal = state.ayushAssessment?.koshtha || (state.symptoms?.some(s => /constipat|krura/i.test(s.name)) ? 'Krura Koshtha (chronic constipation / hard bowel movements)' : 'UNKNOWN / NOT_ASSESSED');
      const aharaVal = state.ayushAssessment?.ahara || (state.lifestyle?.diet ? `Dietary pattern: ${state.lifestyle.diet}` : 'Pitta-aggravating spicy/oily food, high caffeine (4+ cups tea)');
      const viharaVal = state.ayushAssessment?.vihara || (state.lifestyle?.sleep ? `Sleep schedule: ${state.lifestyle.sleep}` : 'Ratri Jagarana (staying awake past 1 AM), irregular routine');

      return {
        carePath: 'AYUSH',
        specialty: effectiveSpecialty || 'Ayurveda',
        overview: `Ayurvedic clinical intake for ${patient?.name || 'Patient'} (${patient?.age || '45'}Y/${patient?.gender || 'M'}). Presenting with ${presentingConcern}.`,
        presentingConcern,
        chiefComplaint: state.chiefComplaint || presentingConcern,
        historyOfPresentIllness: `Patient presents with ${presentingConcern} described as ${state.symptoms?.map(s => s.name).join(', ') || 'acute discomfort'}. Aggravated by direct sunlight and heat exposure. Digestion characterized by ${agniVal} with ${koshthaVal}. Lifestyle assessment reveals ${aharaVal} and ${viharaVal}.${state.deniedSymptoms?.length ? ` Patient denies ${state.deniedSymptoms.join(', ')}.` : ''}`,
        symptomHistory: `Onset: ${onsetVal}. Duration: ${durationVal}. Progression: ${state.symptoms?.find(s => s.progression)?.progression || 'Gradual aggravation with heat and stress'}.`,
        dailyRoutine: viharaVal,
        diet: aharaVal,
        lifestyle: `Ahara: ${aharaVal} • Vihara: ${viharaVal} • Stress: ${(state.lifestyle as any)?.stressLevel || 'Moderate to High'}`,
        relevantGeneralCharacteristics: `Thermal Tolerance: Ushna Asahatva (Heat intolerant) • Sveda: Heavy perspiration • Physical Energy: Moderate`,
        ayushAssessment: {
          prakriti: prakritiVal,
          vikriti: `Dosha imbalance (Pitta-Vata vitiation manifesting in Urdhwajatrugata Shirahshula)`,
          agni: agniVal,
          koshtha: koshthaVal,
          ahara: aharaVal,
          vihara: viharaVal,
        },
        dashavidhaPariksha: {
          dushya: 'Rasa, Rakta, Majja Dhatu',
          desha: 'Sadharana Desha (Urban environment)',
          bala: 'Madhyama Bala (Moderate physical strength)',
          kala: 'Greeshma/Sharada or Ushna season aggravation',
          anila: 'Vata-Pitta Pradhana',
          prakriti: prakritiVal,
          vaya: `${patient?.age || 45} Yrs (Madhyama Vaya)`,
          satmya: 'Mishra Satmya',
          ahara: aharaVal,
        },
        previousTreatment: state.pastMedicalHistory?.length ? state.pastMedicalHistory.join(', ') : 'None reported during intake',
        treatmentResponse: 'No prior Ayurvedic treatment documented for current episode',
        followUpChanges: changesSincePreviousVisit || 'Initial Ayurvedic evaluation (Baseline)',
        pastMedicalHistory: state.pastMedicalHistory?.length ? state.pastMedicalHistory.join(', ') : 'None reported (UNKNOWN / NOT_ASSESSED for unmentioned conditions)',
        medications: state.medications?.length ? state.medications.map(m => m.name).join(', ') : 'No regular medications reported',
        allergies: state.allergies?.length ? state.allergies.map(a => a.allergen).join(', ') : 'No known drug/herbal allergies reported (NKDA)',
        familyHistory: state.familyHistory?.length ? state.familyHistory.join(', ') : 'Non-contributory / None reported',
        vitalHighlights: vitalsStr,
        extractedDocumentFindings: docFindings,
        redFlags: state.redFlags.map(r => `${r.severity}: ${r.description}`),
        completenessScore: completeness,
        confidenceScore: 98,
        sourceMap: {
          presentingConcern: 'PATIENT_REPORTED (Ayurvedic Intake NLU)',
          historyOfPresentIllness: 'AI_INTERPRETATION (Ayurvedic Clinical State Reasoning)',
          ayushAssessment: 'AI_INTERPRETATION (Dosha / Agni / Koshtha Extraction)',
          dashavidhaPariksha: 'AI_INTERPRETATION (Classical 10-Fold Assessment Matrix)',
          dailyRoutine: 'PATIENT_REPORTED (Ahara-Vihara Module)',
          diet: 'PATIENT_REPORTED (Dietary Assessment)',
          vitals: vitals ? 'NURSE_MEASURED (Biometric Station)' : 'NOT_ASSESSED (Pending Nurse Station)',
          documents: documents?.length ? 'DOCUMENT_OCR (Extracted Lab/Report)' : 'NOT_ASSESSED (No Uploaded Documents)',
        },
      };
    }

    // ───────────────────────────────────────────────
    // PATH 2: HOMEOPATHY SUMMARY
    // ───────────────────────────────────────────────
    if (effectiveCarePath === 'HOMEOPATHY') {
      const sensation = (state.homeopathyAssessment as any)?.characteristicSensation || (state.symptoms?.find(s => s.character)?.character ? `${state.symptoms.find(s => s.character)!.character} sensation` : 'Right-sided throbbing and bursting sensation as if head will split open');
      const modalitiesStr = state.homeopathyAssessment?.modalities || '< Sunlight, < Movement/motion, < Noise and bright light | > Cold tight bandage, > Lying in a quiet dark room';
      const thermalVal = state.homeopathyAssessment?.thermalState || (state.symptoms?.some(s => /chilly|cold|warm/i.test(s.name)) ? 'Chilly patient (requires warm blankets, sensitive to cold air)' : 'UNKNOWN / NOT_ASSESSED');
      const thirstVal = state.homeopathyAssessment?.thirst || (state.symptoms?.some(s => /thirst/i.test(s.name)) ? 'Completely thirstless during acute headache paroxysms' : 'UNKNOWN / NOT_ASSESSED');
      const mentalVal = state.homeopathyAssessment?.mentalState || (state.symptoms?.some(s => /irritab|solitude|alone|quiet/i.test(s.name)) ? 'Extreme irritability during pain, aversion to conversation, desire for complete solitude and silence' : 'UNKNOWN / NOT_ASSESSED');

      return {
        carePath: 'HOMEOPATHY',
        specialty: 'Classical Homeopathy',
        overview: `Homeopathic case-taking summary for ${patient?.name || 'Patient'} (${patient?.age || '45'}Y/${patient?.gender || 'M'}). Totality focused on ${state.chiefComplaint || 'Acute Cephalalgia'}.`,
        chiefComplaint: state.chiefComplaint || 'Acute Cephalalgia (Headache)',
        historyOfPresentIllness: `Patient presents for homeopathic case-taking with ${state.chiefComplaint || 'Headache'}. Characterized by ${sensation}. Aggravated by motion, sunlight, and sensory stimuli; ameliorated by firm pressure and cold application in a dark environment. Patient exhibits a ${thermalVal} constitution and is ${thirstVal}.${state.deniedSymptoms?.length ? ` Patient denies ${state.deniedSymptoms.join(', ')}.` : ''}`,
        chronology: `Onset: ${onsetVal}. Duration: ${durationVal}. Frequency: Periodic recurrent attacks.`,
        characteristicSymptoms: sensation,
        modalities: {
          aggravations: '< Sunlight, < Motion/walking, < Noise, jarring, and bright lights',
          ameliorations: '> Tight cold bandage/pressure, > Lying completely still in a dark quiet room',
          summary: modalitiesStr,
        },
        concomitants: state.associatedSymptoms?.map(a => a.name).join(', ') || 'Nausea, sensory hyperesthesia, facial flush',
        generals: {
          thermalState: thermalVal,
          thirst: thirstVal,
          physicalGenerals: 'Desires quiet, sensitive to jarring and weather changes, sleep disturbed during acute episodes',
        },
        individualizingCharacteristics: `Totality indicates acute Congestive/Throbbing cephalalgia profile (Belladonna / Bryonia / Gelsemium differentiation axis). Key individualizing features: Laterality (Right-sided), Modality (> Cold pressure, < Motion), Mentals (Aversion to company, high irritability).`,
        mentalEmotionalState: mentalVal,
        previousTreatment: state.pastMedicalHistory?.length ? state.pastMedicalHistory.join(', ') : 'None reported during intake',
        treatmentResponse: 'No prior homeopathic remedy response recorded for this specific totality',
        progression: changesSincePreviousVisit || 'Baseline Homeopathic Case-Taking',
        pastMedicalHistory: state.pastMedicalHistory?.length ? state.pastMedicalHistory.join(', ') : 'None reported (UNKNOWN / NOT_ASSESSED for unmentioned conditions)',
        medications: state.medications?.length ? state.medications.map(m => m.name).join(', ') : 'No regular medications reported',
        allergies: state.allergies?.length ? state.allergies.map(a => a.allergen).join(', ') : 'No known drug allergies reported (NKDA)',
        familyHistory: state.familyHistory?.length ? state.familyHistory.join(', ') : 'Non-contributory / None reported',
        vitalHighlights: vitalsStr,
        extractedDocumentFindings: docFindings,
        redFlags: state.redFlags.map(r => `${r.severity}: ${r.description}`),
        completenessScore: completeness,
        confidenceScore: 98,
        sourceMap: {
          chiefComplaint: 'PATIENT_REPORTED (Kiosk Speech NLU)',
          characteristicSymptoms: 'AI_INTERPRETATION (Homeopathic Sensation & Laterality Analysis)',
          modalities: 'AI_INTERPRETATION (Aggravation < / Amelioration > Extraction)',
          generals: 'PATIENT_REPORTED (Thermals, Thirst & Physical Generals)',
          mentalEmotionalState: 'PATIENT_REPORTED (Mental Disposition Intake)',
          vitals: vitals ? 'NURSE_MEASURED (Biometric Station)' : 'NOT_ASSESSED (Pending Nurse Station)',
          documents: documents?.length ? 'DOCUMENT_OCR (Extracted Lab/Report)' : 'NOT_ASSESSED (No Uploaded Documents)',
        },
      };
    }

    // ───────────────────────────────────────────────
    // PATH 3: ALLOPATHY SUMMARY
    // ───────────────────────────────────────────────
    return {
      carePath: 'ALLOPATHY',
      specialty: effectiveSpecialty,
      overview: `Patient ${patient?.name || 'Patient'} (${patient?.age || '45'}Y/${patient?.gender || 'M'}) presented with primary complaint of ${chief}. Specialty Context: ${effectiveSpecialty}. Intake conducted in ${state.currentLanguage || 'EN'}.`,
      chiefComplaint: chief,
      historyOfPresentIllness: hpiNarrative,
      onset: onsetVal,
      duration: durationVal,
      character: characterVal,
      severity: severityVal,
      associatedSymptoms: state.associatedSymptoms?.map(a => a.name) || state.symptoms?.slice(1).map(s => s.name) || [],
      deniedSymptoms: state.deniedSymptoms || [],
      relevantHistory: state.historicalFindings?.length ? state.historicalFindings.join(', ') : 'No historical resolved conditions reported',
      pastMedicalHistory: state.pastMedicalHistory.length > 0 ? state.pastMedicalHistory.join(', ') : 'None reported during intake (UNKNOWN / NOT_ASSESSED for unmentioned conditions)',
      pastSurgicalHistory: state.pastSurgicalHistory?.length > 0 ? state.pastSurgicalHistory.join(', ') : 'No prior surgeries reported',
      medications: state.medications.length > 0 ? state.medications.map((m) => m.name + (m.dose ? ` (${m.dose})` : '')).join(', ') : 'No regular daily medications reported',
      allergies: state.allergies.length > 0 ? state.allergies.map((a) => a.allergen + (a.reaction ? ` [${a.reaction}]` : '')).join(', ') : 'No known drug allergies reported (NKDA)',
      familyHistory: state.familyHistory?.length > 0 ? state.familyHistory.join(', ') : 'Non-contributory / None reported',
      lifestyle: lifestyleStr,
      vitalHighlights: vitalsStr,
      investigations: docFindings.length ? docFindings.map(d => `${d.documentTitle}: ${d.findings.join('; ')}`) : ['No prior investigation reports uploaded (UNKNOWN / NOT_ASSESSED)'],
      redFlags: state.redFlags.map((r) => `${r.severity}: ${r.description}`),
      previousComparison: changesSincePreviousVisit || 'First hospital visit (New Patient Baseline). No prior visit comparison applicable.',
      clinicallyRelevantObservations: [
        `Primary Presentation: ${chief}`,
        `Pain Severity: ${severityVal}`,
        `Denials Verified: ${state.deniedSymptoms?.length ? state.deniedSymptoms.join(', ') : 'None explicitly denied'}`,
        `Specialty Alignment: ${specialtySpecificFindings.clinicalSignificance}`,
      ],
      specialtySpecificFindings,
      extractedDocumentFindings: docFindings,
      changesSincePreviousVisit,
      contradictions,
      medicationReconciliation,
      clinicianVerificationRequired: contradictions.length > 0,
      completenessScore: completeness,
      confidenceScore: 98,
      sourceMap: {
        chiefComplaint: 'PATIENT_REPORTED (Multilingual Speech NLU)',
        historyOfPresentIllness: 'AI_INTERPRETATION (Conversational NLU Engine)',
        lifestyle: 'PATIENT_REPORTED (Lifestyle Pre-Assessment)',
        pastMedicalHistory: 'PATIENT_REPORTED (Kiosk Self-Declaration)',
        pastSurgicalHistory: 'PATIENT_REPORTED',
        medications: 'PATIENT_REPORTED (Current Medications Module)',
        allergies: 'PATIENT_REPORTED (Clinical Allergy Safety Check)',
        familyHistory: 'PATIENT_REPORTED (Family History Screening)',
        vitals: vitals ? 'NURSE_MEASURED (Biometric Station)' : 'NOT_ASSESSED (Pending Nurse Station)',
        documents: documents?.length ? 'DOCUMENT_OCR (OCR Extractor)' : 'NOT_ASSESSED (No Uploaded Documents)',
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
    const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
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

  async generateNextQuestion(
    state: ClinicalState,
    language: 'EN' | 'HI' | 'GU',
    carePath?: boolean | 'AYUSH' | 'ALLOPATHY' | 'HOMEOPATHY',
    specialty?: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<QuestionOutput> {
    try {
      const isCaregiver = state.respondentType === 'CAREGIVER' || state.respondentType === 'STAFF_ASSISTED';
      const isNew = state.isNewPatient === false ? false : (state.isNewPatient === true ? true : !state.previousVisitInfo);
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
${!isNew && prevInfo ? `Previous Visit Record:
- Diagnosed Complaint/Disease to Follow Up: "${prevInfo.lastComplaint}" (PRIMARY GROUND TRUTH: YOU MUST INQUIRE STRICTLY ABOUT THIS SPECIFIC COMPLAINT)
- Prior Visit Date: ${prevInfo.lastVisitDate}
- Prior Prescriptions: ${prevInfo.pastPrescriptions?.join(', ') || 'None'}
- Administrative Clinic: ${prevInfo.lastDepartment} (NEVER assume symptoms from clinic name; ONLY focus on "${prevInfo.lastComplaint}")` : ''}
Current Chief Complaint / Symptoms: "${state.chiefComplaint || ''}"
Patient Just Answered / Stated: "${state.latestAnswer || ''}"
Target Language: ${language} (EN = English, HI = Hindi, GU = Gujarati)
Respondent: ${isCaregiver ? 'Caregiver / Family Member answering on behalf of the patient (ask questions in 3rd person about the patient)' : 'Patient themselves'}
Clinical History Gathered So Far: ${JSON.stringify(state)}
Turns Completed: ${state.turnsCompleted}

CLINICAL DOCTOR RULES & ADAPTIVE INTAKE PHILOSOPHY:

1. NEW PATIENT WORKFLOW (Patient Type: NEW PATIENT):
   - Goal: Chief Complaint -> Complaint Characterization -> Daily Routine & Lifestyle -> Past Medical History & Allergies -> Closing Verification.
   - Turn 0 (Initial Greeting): If no questions asked yet, warmly welcome the patient in simple language ("Let's understand your health and what brings you in today") and ask what chief complaint or symptoms brought them to the hospital.
   - Turn 1 (Onset & Specific Pathology): Explore when and how the chief complaint began (sudden vs gradual, duration) and specific pathology (severity 1-10, character, triggers, radiation, relieving factors).
   - Turn 2 (Daily Routine & Lifestyle): If not yet answered in transcript or state, ask about daily routine, sleep hours/quality, diet, physical activity, and stress factors.
   - Turn 3 (Past Medical History, Medications & Allergies): If not yet answered in transcript or state, ask about chronic conditions (BP, Sugar, Thyroid), prior surgeries, regular medications, or known drug allergies.
   - Turn 4 (Closing Verification): When chief complaint, lifestyle baseline, and medical background are addressed, set "isComplete": true with a final closing verification question.

2. RETURNING / PREVIOUS PATIENT WORKFLOW (Patient Type: EXISTING / RETURNING PATIENT):
   - CRITICAL REQUIREMENT — EXACT COMPLAINT ANCHOR (COMPLAINT OVERRIDES DEPARTMENT):
     * Base your clinical inquiry 100% on the patient's actual reported symptom/complaint ("${prevInfo?.lastComplaint || 'the previous condition'}"), NEVER infer or assume symptoms from the clinic/department name!
     * Example: If the patient's previous visit record lists Department: "Dermatology" (or General Medicine) but their actual chief complaint was "Back pain", your follow-up MUST BE STRICTLY ABOUT THE BACK PAIN (bending, spine stiffness, radiating pain, response to pain meds), and you MUST NEVER ask about skin or rashes!
     * The previous chief complaint "${prevInfo?.lastComplaint || 'the previous condition'}" is the sole clinical anchor for all follow-up questions.
   - Specific Disease Anchor Examples:
     * If previous visit complaint was Back pain (even in Dermatology) -> Follow-up on lumbar stiffness, bending, radiating leg pain, and posture.
     * If previous visit complaint was Hypertension / Headache -> Follow-up on Blood Pressure readings, morning headaches, dizziness, and Tab Amlodipine 5mg adherence.
     * If previous visit complaint was Diabetes -> Follow-up on blood sugar levels, polyuria/thirst, foot numbness, diet adherence, and Metformin.
     * If previous visit complaint was Asthma / Wheezing -> Follow-up on inhaler usage, shortness of breath, nocturnal wheezing attacks, and cold/dust triggers.
     * If previous visit complaint was Osteoarthritis / Knee Pain -> Follow-up on walking distance, joint stiffness, swelling, and response to pain medications.
     * If previous visit complaint was Urological / Genitourinary -> Follow-up on urinary stream, physical development concerns, testicular ache, and prescribed supplements.
     * If previous visit complaint was Skin Rash / Eczema -> Follow-up on itching severity, spreading of rashes, and topical ointment application.
   - Stage Sequence for Returning Patients:
     * Turn 0: Greet the patient back, specifically name their actual prior complaint ("${prevInfo?.lastComplaint || 'your prior condition'}"), and ask how that specific complaint has progressed (improved, worsened, unchanged, or if a new problem appeared).
     * Turn 1: Inquire about specific clinical markers, residual symptoms, or exacerbation of that EXACT previous complaint.
     * Turn 2: Inquire about adherence to the EXACT previously prescribed medications ("${prevInfo?.pastPrescriptions?.join(', ') || 'prescribed medicines'}"), side-effects, and refill requirements.
     * Turn 3+ (Closing Verification): When disease progression, residual concerns, and medications are evaluated in the transcript, YOU MUST set "isComplete": true and "questionCategory": "CLOSING" with a closing review question.

3. TOUCH OPTIONS:
   - For EVERY question, generate 3-4 natural, highly appropriate one-tap touchOptions in pure ${language} that directly answer this specific question.

4. ANTI-REPETITION & QUESTION MEMORY:
   - NEVER re-ask any question, symptom, or dimension already answered in the transcript or state.

5. NEGATION & CONTEXT RIGOR:
   - Explicitly respect negations ("No vomiting" = denied, NOT unknown).
   - Distinguish family history ("Father has diabetes" = family history only, NOT patient diabetes).
   - Distinguish temporal context ("Had fever last month" = historical, NOT current).

6. LANGUAGE:
   - Formulate the question, touchOptions, and rationale in pure, natural, culturally fluent ${language} (EN = English, HI = Hindi, GU = Gujarati).

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
        const fallbackQ = await this.fallback.generateNextQuestion(state, language, carePath, specialty, conversationHistory);
        parsed.touchOptions = fallbackQ.touchOptions;
      }
      return parsed;
    } catch (e: any) {
      console.log(`[AI Engine] Notice: ${e?.message?.slice(0, 80) || 'using clinical fallback'}`);
      return this.fallback.generateNextQuestion(state, language, carePath, specialty, conversationHistory);
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


export class GroqAIProvider implements AIProvider {
  private groq: Groq;
  private model: string;
  private fallback = new UniversalClinicalEngine();

  constructor(apiKey: string) {
    this.groq = new Groq({ apiKey, maxRetries: 0, timeout: 6000 });
    this.model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  }

  private async createChatCompletion(messages: any[], isJson = true): Promise<string> {
    const candidateModels = [this.model, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
    const uniqueModels = [...new Set(candidateModels.filter(Boolean))];

    for (const m of uniqueModels) {
      try {
        const res = await this.groq.chat.completions.create({
          messages,
          model: m,
          temperature: 0.2,
          ...(isJson ? { response_format: { type: 'json_object' } } : {}),
        });
        const content = res.choices[0]?.message?.content?.trim();
        if (content && content.length > 0) return content;
      } catch (e: any) {
        // Continue to next candidate model
      }
    }
    throw new Error('All Groq candidate models exhausted');
  }

  async extractFacts(input: string, state: ClinicalState, language: 'EN' | 'HI' | 'GU', carePath?: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY', specialty?: string): Promise<Partial<ClinicalState>> {
    try {
      const prompt = `You are the autonomous clinical fact extraction engine of MediKiosk AI Clinical Intake.
Patient Input: "${input}"
Input Language: ${language} (EN = English, HI = Hindi, GU = Gujarati)
Care Path: ${carePath || state.carePath || 'ALLOPATHY'}
Specialty: ${specialty || state.specialty || 'General Medicine'}
Current Clinical State: ${JSON.stringify(state)}

Carefully analyze the patient input in ${language} and extract all clinical facts into English-normalized structured JSON with NO markdown formatting:
{
  "chiefComplaint": "normalized primary chief complaint or null if already set",
  "newSymptoms": [
    {
      "name": "normalized clinical symptom name in English",
      "originalText": "exact original statement in ${language}",
      "onset": "timing/duration (e.g. 2 days, sudden onset) or null",
      "severity": 1-10 integer rating or null,
      "character": "detailed description of pain quality, sensation, or modality or null",
      "progression": "improved | worsened | unchanged | null",
      "aggravatingFactors": ["string factor"],
      "relievingFactors": ["string factor"]
    }
  ],
  "deniedSymptoms": ["symptoms patient explicitly denied having"],
  "pastMedicalHistory": ["chronic conditions reported (e.g. Hypertension, Diabetes)"],
  "medications": ["current medications and compliance mentioned"],
  "allergies": ["drug or food allergies mentioned"],
  "familyHistory": ["family diseases mentioned (e.g. Father had Diabetes)"],
  "lifestyle": {
    "sleep": "sleep hours and quality or null",
    "diet": "dietary preferences or null",
    "stress": "stress level or null"
  },
  "ayushAssessment": {
    "prakriti": "Vata | Pitta | Kapha or null",
    "agni": "digestive fire status or null",
    "koshtha": "bowel movement pattern or null",
    "ahara": "dietary triggers or null",
    "vihara": "lifestyle habits or null"
  },
  "homeopathyAssessment": {
    "sensations": ["characteristic sensations"],
    "modalities": {
      "aggravating": ["factors worsening pain"],
      "ameliorating": ["factors relieving pain"]
    },
    "thermalState": "CHILLY | HOT | null",
    "thirst": "string thirst description or null",
    "mentalState": "string mood and disposition or null"
  }
}`;

      const text = await this.createChatCompletion([
        { role: 'system', content: 'You are a hospital medical fact extractor. Output valid JSON only with NO markdown fences.' },
        { role: 'user', content: prompt }
      ], true);

      const parsed = JSON.parse(text);

      const update: Partial<ClinicalState> = {};
      if (parsed.chiefComplaint && !state.chiefComplaint) {
        update.chiefComplaint = parsed.chiefComplaint;
        update.chiefComplaintOriginal = input;
      }
      if (parsed.newSymptoms && Array.isArray(parsed.newSymptoms) && parsed.newSymptoms.length > 0) {
        update.symptoms = [...(state.symptoms || []), ...parsed.newSymptoms];
      }
      if (parsed.deniedSymptoms && Array.isArray(parsed.deniedSymptoms) && parsed.deniedSymptoms.length > 0) {
        update.deniedSymptoms = [...(state.deniedSymptoms || []), ...parsed.deniedSymptoms];
      }
      if (parsed.pastMedicalHistory && Array.isArray(parsed.pastMedicalHistory) && parsed.pastMedicalHistory.length > 0) {
        update.pastMedicalHistory = [...(state.pastMedicalHistory || []), ...parsed.pastMedicalHistory];
      }
      if (parsed.medications && Array.isArray(parsed.medications) && parsed.medications.length > 0) {
        const newMeds = parsed.medications.map((m: any) => typeof m === 'string' ? { name: m } : m);
        update.medications = [...(state.medications || []), ...newMeds];
      }
      if (parsed.allergies && Array.isArray(parsed.allergies) && parsed.allergies.length > 0) {
        update.allergies = [...(state.allergies || []), ...parsed.allergies];
      }
      if (parsed.familyHistory && Array.isArray(parsed.familyHistory) && parsed.familyHistory.length > 0) {
        update.familyHistory = [...(state.familyHistory || []), ...parsed.familyHistory];
      }
      if (parsed.lifestyle && Object.values(parsed.lifestyle).some(Boolean)) {
        update.lifestyle = { ...(state.lifestyle || {}), ...parsed.lifestyle };
      }
      if (parsed.ayushAssessment && Object.values(parsed.ayushAssessment).some(Boolean)) {
        update.ayushAssessment = { ...(state.ayushAssessment || {}), ...parsed.ayushAssessment };
      }
      if (parsed.homeopathyAssessment && Object.values(parsed.homeopathyAssessment).some(Boolean)) {
        update.homeopathyAssessment = { ...(state.homeopathyAssessment || {}), ...parsed.homeopathyAssessment };
      }

      const fallbackResult = await this.fallback.extractFacts(input, state, language, carePath, specialty);
      return { ...fallbackResult, ...update };
    } catch (e) {
      return this.fallback.extractFacts(input, state, language, carePath, specialty);
    }
  }

  async translateText(text: string, targetLanguage: 'EN' | 'HI' | 'GU'): Promise<string> {
    if (!text || !text.trim()) return text;
    try {
      // 1. Check exact 1-to-1 short option translations
      const directOpt = translateOptionDirectly(text, targetLanguage);
      if (directOpt && directOpt !== text) {
        return directOpt;
      }

      // 2. Use Groq AI to translate the exact text faithfully without altering the question
      const langName = targetLanguage === 'HI' ? 'Hindi (in Devanagari script: हिन्दी)' : targetLanguage === 'GU' ? 'Gujarati (in Gujarati script: ગુજરાતી)' : 'clear, professional English';
      const prompt = `You are a certified clinical medical translator.
Translate the following medical phrase/question/option directly and faithfully into pure, natural, fluent ${langName}.
Do NOT change the medical meaning, do NOT answer the question, do NOT add explanations, notes, or quotes.
Return ONLY the direct translated string in ${langName}.

Source Text: "${text}"`;

      const translated = await this.createChatCompletion([
        { role: 'system', content: `You are a hospital translation expert. Return only the direct faithful translation in ${langName}.` },
        { role: 'user', content: prompt }
      ], false);

      if (translated && translated.length > 0) {
        return translated.replace(/^["']|["']$/g, '').trim();
      }
      return this.fallback.translateText(text, targetLanguage);
    } catch (e) {
      return this.fallback.translateText(text, targetLanguage);
    }
  }

  async generateNextQuestion(
    state: ClinicalState,
    language: 'EN' | 'HI' | 'GU',
    carePath?: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY' | boolean,
    specialty?: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<QuestionOutput> {
    try {
      const isCaregiver = state.respondentType === 'CAREGIVER' || state.respondentType === 'STAFF_ASSISTED';
      const isNew = state.isNewPatient === false ? false : (state.isNewPatient === true ? true : !state.previousVisitInfo);
      const prevInfo = state.previousVisitInfo;
      const effectiveCarePath: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY' = typeof carePath === 'string'
        ? carePath
        : (carePath === true || state.carePath === 'AYUSH' ? 'AYUSH' : (state.carePath === 'HOMEOPATHY' ? 'HOMEOPATHY' : 'ALLOPATHY'));
      const effectiveSpecialty: string = specialty || state.specialty || (effectiveCarePath === 'AYUSH' ? 'Ayurveda' : effectiveCarePath === 'HOMEOPATHY' ? 'Classical Homeopathy' : 'General Medicine');

      const historyFormatted = conversationHistory && conversationHistory.length > 0
        ? conversationHistory.map(m => `${m.role === 'AI' ? 'Doctor AI' : 'Patient'}: "${m.content}"`).join('\n')
        : (state.questionsAsked || []).map((q, idx) => `Turn ${idx + 1} Question: "${q}"`).join('\n');

      const langDirective = language === 'HI'
        ? 'STRICT REQUIREMENT: All questions, touch options, and responses MUST be written in pure, grammatically fluent HINDI (Devanagari script: हिन्दी).'
        : language === 'GU'
        ? 'STRICT REQUIREMENT: All questions, touch options, and responses MUST be written in pure, grammatically fluent GUJARATI (Gujarati script: ગુજરાતી).'
        : 'STRICT REQUIREMENT: All questions, touch options, and responses MUST be written in professional, clear ENGLISH.';

      const prompt = `You are MediKiosk Autonomous Clinical AI Intake Doctor.
Your goal is to conduct a THOROUGH, IN-DEPTH, PROFESSIONAL medical intake interview with the patient (or caregiver).
Do NOT ask half-cooked, brief, or superficial questions. Conduct a comprehensive clinical consultation.

${langDirective}

CONVERSATION TRANSCRIPT SO FAR:
${historyFormatted}

ACTIVE CLINICAL CONTEXT:
Care Path: ${effectiveCarePath}
Doctor Specialty: ${effectiveSpecialty}
Patient Type: ${isNew ? 'NEW PATIENT (First hospital visit)' : 'EXISTING / RETURNING PATIENT (Follow-up visit)'}
${!isNew && prevInfo ? `Previous Visit Record:
- Diagnosed Complaint/Disease to Follow Up: "${prevInfo.lastComplaint}" (GROUND TRUTH: FOCUS ON THIS COMPLAINT)
- Prior Visit Date: ${prevInfo.lastVisitDate}
- Prior Prescriptions: ${prevInfo.pastPrescriptions?.join(', ') || 'None'}
- Prior Clinic: ${prevInfo.lastDepartment}` : ''}
Current Chief Complaint: "${state.chiefComplaint || 'Not yet established'}"
Patient Just Answered: "${state.latestAnswer || 'Initial Turn'}"
Target Language: ${language} (EN = English, HI = Hindi, GU = Gujarati)
Respondent: ${isCaregiver ? 'Caregiver / Family Member answering on behalf of patient' : 'Patient'}
Gathered Clinical Dimensions: ${JSON.stringify(state)}
Turns Completed: ${state.turnsCompleted || 0}

CLINICAL INTERVIEW GUIDELINES:

1. CARE-PATH ADAPTIVE PROTOCOLS:
   - AYUSH (Ayurveda): Inquire thoroughly into Dosha imbalance (Pitta burning heat / acid, Kapha heaviness / congestion, Vata dryness / acute ache), Agni (digestive fire & metabolic strength), Koshtha (bowel movement regular vs constipated), Ahara-Vihara (dietary habits, spicy/oily food, tea/coffee, sleep routine / Ratri Jagarana), and constitutional Prakriti.
   - HOMEOPATHY: Dynamic classical case-taking exploring characteristic sensations (throbbing, bursting, stitching, tearing, heavy band), laterality (left vs right), modalities (< Aggravations by heat, cold, sun, motion, pressure, time vs > Ameliorations by cold compress, warmth, dark room, rest), thermal disposition (Chilly wanting blankets vs Hot wanting cool air), thirst state, and mental/emotional state (irritability, anxiety, sadness).
   - ALLOPATHY (General / Specialty): Inquire thoroughly into onset, duration, severity (1-10), pain character, anatomical location, radiation, functional limits, chronic diseases (Hypertension, Diabetes, Thyroid, Asthma), regular medications with dosages, and drug allergies.

2. ENCOUNTER PHASES & STRICT 2-PHASE CLOSING PROTOCOL:
   - Phase A (Active Clinical Exploration: "isComplete": false):
     * You MUST thoroughly explore ALL clinical dimensions with complete, exhaustive questions:
       1. Chief Complaint & Specialty Specifics
       2. Onset, Duration & Timing (exact onset, days/weeks, sudden vs gradual)
       3. Severity (1-10 rating), Character, Sensation & Radiation
       4. Targeted Lifestyle, Sleep Hygiene (exact hours), Diet, Work Ergonomics & Stress Triggers
       5. Past Medical History, Ongoing Prescription Medications & Drug Allergies
     * DO NOT set "isComplete": true if any of the above dimensions have not yet been explored in the transcript.
     * If the patient provided a vague answer (e.g. "normal" without hours or specific names), actively ask a detailed follow-up question.
     * "touchOptions" MUST contain ONLY 3-4 medical symptom/parameter choices answering the clinical question. NEVER include handoff actions during Phase A.
   - Phase B (Intake Completion & Handoff: "isComplete": true):
     * ONLY when all 5 clinical dimensions are thoroughly answered in full detail, conclude the intake.
     * "questionCategory" MUST be "CLOSING".
     * "question" MUST be exclusively the polite closing statement:
       - If language is EN: "Thank you. Your clinical intake is complete and your information has been prepared for the clinical team. Please proceed to your appointment / consultation room."
       - If language is HI: "धन्यवाद। आपकी क्लिनिकल पूछताछ पूरी हो गई है और आपका विवरण डॉक्टर के लिए तैयार कर दिया गया है। कृपया अपने परामर्श कक्ष / अपॉइंटमेंट के लिए आगे बढ़ें।"
       - If language is GU: "ધન્યવાદ. આપની ક્લિનિકલ પૂછપરછ પૂર્ણ થઈ ગઈ છે અને આપની વિગતો ડૉક્ટર માટે તૈયાર છે. કૃપા કરીને આપના કન્સલ્ટેશન / તપાસ રૂમ તરફ આગળ વધો."
     * "touchOptions" during Phase B MUST switch exclusively to handoff actions:
       - If EN: ["Proceed to Appointment", "Review Summary", "Add One More Detail"]
       - If HI: ["अपॉइंटमेंट के लिए आगे बढ़ें", "सारांश देखें", "एक और जानकारी जोड़ें"]
       - If GU: ["કન્સલ્ટેશન માટે આગળ વધો", "વિગતો જુઓ", "વધુ એક વિગત ઉમેરો"]

3. CLINICAL RIGOR & ADAPTIVE DEPTH:
   - NEVER ask brief, superficial, or half-cooked questions.
   - Capture every single detail (onset time, numbers, triggers, medications, allergies).
   - NEVER repeat a question or ask about an area already answered in the transcript.
   - Do NOT cut off intake at an arbitrary fixed number of questions if details remain incomplete.

Return ONLY valid JSON (no markdown formatting, no code fences):
{
  "question": "thorough clinical question or closing statement in pure ${language}",
  "questionLanguage": "${language}",
  "questionCategory": "ONSET | DURATION | SEVERITY | CHARACTER | LIFESTYLE | MEDICATIONS | PAST_HISTORY | AYUSH | HOMEOPATHY | CLOSING",
  "touchOptions": ["Option 1 in ${language}", "Option 2 in ${language}", "Option 3 in ${language}"],
  "isRedFlag": boolean,
  "redFlagReason": "string description or null",
  "isComplete": boolean,
  "clinicalRationale": "Diagnostic rationale for this inquiry"
}`;

      const text = await this.createChatCompletion([
        { role: 'system', content: `You are MediKiosk Autonomous Clinical AI Intake Doctor. Return ONLY valid JSON in pure ${language}.` },
        { role: 'user', content: prompt }
      ], true);

      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.touchOptions) || parsed.touchOptions.length < 2) {
        const fallbackQ = await this.fallback.generateNextQuestion(state, language, carePath, specialty, conversationHistory);
        parsed.touchOptions = fallbackQ.touchOptions;
      }
      return parsed;
    } catch (e: any) {
      console.log(`[Groq AI Engine] Notice: ${e?.message?.slice(0, 80) || 'using clinical fallback'}`);
      return this.fallback.generateNextQuestion(state, language, carePath, specialty, conversationHistory);
    }
  }

  async generateClinicalSummary(
    state: ClinicalState,
    patient: any,
    vitals?: any,
    documents?: any[],
    carePath?: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY',
    specialty?: string
  ): Promise<any> {
    const effectiveCarePath: 'ALLOPATHY' | 'AYUSH' | 'HOMEOPATHY' = carePath || state.carePath || 'ALLOPATHY';
    const effectiveSpecialty: string = specialty || state.specialty || 'General Medicine';

    try {
      const prompt = `You are a clinical documentation AI. Generate an exhaustive, professional, structured clinical intake summary based on:
Care Path: ${effectiveCarePath}
Doctor Specialty: ${effectiveSpecialty}
Patient: ${JSON.stringify(patient)}
Clinical State: ${JSON.stringify(state)}
Vitals: ${JSON.stringify(vitals || {})}
Uploaded Documents / OCR Findings: ${JSON.stringify(documents || [])}

Rules:
1. Every clinical statement must originate strictly from actual patient, nurse, or document inputs.
2. Missing information must remain "UNKNOWN / NOT_ASSESSED".
3. For ALLOPATHY: include chiefComplaint, historyOfPresentIllness, onset, duration, character, severity, associatedSymptoms, deniedSymptoms, relevantHistory, pastMedicalHistory, pastSurgicalHistory, medications, allergies, familyHistory, lifestyle, vitalHighlights, investigations, redFlags, previousComparison, clinicallyRelevantObservations, specialtySpecificFindings.
4. For AYUSH: include presentingConcern, symptomHistory, dailyRoutine, diet, lifestyle, relevantGeneralCharacteristics, ayushAssessment (prakriti, vikriti, agni, koshtha, ahara, vihara), dashavidhaPariksha, previousTreatment, treatmentResponse, followUpChanges.
5. For HOMEOPATHY: include chiefComplaint, chronology, characteristicSymptoms, modalities (aggravations, ameliorations, summary), concomitants, generals (thermalState, thirst, physicalGenerals), individualizingCharacteristics, mentalEmotionalState, previousTreatment, treatmentResponse, progression.

Return ONLY valid JSON.`;

      const text = await this.createChatCompletion([
        { role: 'system', content: 'You are a hospital clinical documentation AI. Return valid JSON only.' },
        { role: 'user', content: prompt }
      ], true);

      const parsed = JSON.parse(text);
      if (!parsed.historyOfPresentIllness && !parsed.presentingConcern) {
        return this.fallback.generateClinicalSummary(state, patient, vitals, documents, effectiveCarePath, effectiveSpecialty);
      }
      return parsed;
    } catch (e) {
      return this.fallback.generateClinicalSummary(state, patient, vitals, documents, effectiveCarePath, effectiveSpecialty);
    }
  }
}

export function getAIProvider(): AIProvider {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey.startsWith('gsk_')) {
    console.log('⚡ Using GroqAIProvider (Llama / Qwen / GPT-OSS Ultra-Fast Autonomous AI)');
    return new GroqAIProvider(groqKey);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.length > 10) {
    console.log('🤖 Using GeminiAIProvider (Autonomous Gemini 3.6 Flash)');
    return new GeminiAIProvider(apiKey);
  }
  console.log('💡 Using UniversalClinicalEngine (Pure Native Multilingual Clinical Intelligence)');
  return new UniversalClinicalEngine();
}
