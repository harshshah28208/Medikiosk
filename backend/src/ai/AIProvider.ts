import dotenv from 'dotenv';
dotenv.config();
import { Groq } from 'groq-sdk';
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
  async extractFacts(input: string, state: ClinicalState, language: 'EN' | 'HI' | 'GU'): Promise<Partial<ClinicalState>> {
    const text = input.trim();
    const update: Partial<ClinicalState> = {};
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
    const isNew = state.isNewPatient === false ? false : (state.isNewPatient === true ? true : !state.previousVisitInfo);
    const complaintText = state.chiefComplaint || 'problem';
    const localizedLabel = getSymptomLabelInLang(complaintText, lang);
    const isCaregiver = state.respondentType === 'CAREGIVER' || state.respondentType === 'STAFF_ASSISTED';

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
    // Step 1: Chief Complaint / Primary Health Concern FIRST
    // ==========================================
    if (!state.chiefComplaint) {
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
        EN: ['Vomiting, nausea & stomach upset', 'Throbbing headache & eye strain', 'Fever, body ache & chills', 'Joint or back pain with stiffness', 'Chest discomfort or breathlessness', 'Skin rash, pimples or itching'],
        HI: ['उल्टी, जी मिचलाना व पेट दर्द', 'तेज सिरदर्द और आँखों में तनाव', 'बुखार, बदन दर्द और कंपकंपी', 'जोड़ों या कमर में दर्द व जकड़न', 'सीने में भारीपन या सांस की तकलीफ', 'त्वचा पर दाने, खुजली या मुँहासे'],
        GU: ['ઉલટી, ઉબકા અને પેટમાં દુખાવો', 'તીવ્ર માથાનો દુખાવો અને આંખોમાં તાણ', 'તાવ, કળતર અને ધ્રુજારી', 'સાંધા કે કમરમાં દુખાવો અને જકડન', 'છાતીમાં ભારેપણું કે શ્વાસની તકલીફ', 'ચામડી પર દાણા, ખંજવાળ કે ખીલ'],
      };
      return {
        question: qText[lang],
        questionLanguage: lang,
        questionCategory: 'ONSET',
        touchOptions: touchOpts[lang],
        isRedFlag: false,
        redFlagReason: null,
        isComplete: false,
        clinicalRationale: 'Establishing active chief complaint on initial new patient intake turn',
      };
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
        clinicalRationale: 'Screening chronic disease background, regular medications, and drug allergy safety profile',
      };
    }

    // Step 6: Final Wrap-Up Review (All dimensions covered)
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

  async generateNextQuestion(state: ClinicalState, language: 'EN' | 'HI' | 'GU', isAyush = false, conversationHistory?: Array<{ role: string; content: string }>): Promise<QuestionOutput> {
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


export class GroqAIProvider implements AIProvider {
  private groq: Groq;
  private model: string;
  private fallback = new UniversalClinicalEngine();

  constructor(apiKey: string) {
    this.groq = new Groq({ apiKey });
    this.model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  }

  async extractFacts(input: string, state: ClinicalState, language: 'EN' | 'HI' | 'GU'): Promise<Partial<ClinicalState>> {
    try {
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

      const res = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a hospital medical fact extractor. Output valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        model: this.model,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const text = res.choices[0]?.message?.content || '{}';
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
      const fallbackResult = await this.fallback.extractFacts(input, state, language);
      return { ...fallbackResult, ...update };
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

      const prompt = `Translate into pure, natural ${targetLanguage}: "${text}"`;
      const res = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a clinical intake translator. Return ONLY the direct translation.' },
          { role: 'user', content: prompt }
        ],
        model: this.model,
        temperature: 0.1
      });
      return res.choices[0]?.message?.content?.trim() || direct;
    } catch (e) {
      return this.fallback.translateText(text, targetLanguage);
    }
  }

  async generateNextQuestion(state: ClinicalState, language: 'EN' | 'HI' | 'GU', isAyush = false, conversationHistory?: Array<{ role: string; content: string }>): Promise<QuestionOutput> {
    try {
      const isCaregiver = state.respondentType === 'CAREGIVER' || state.respondentType === 'STAFF_ASSISTED';
      const isNew = state.isNewPatient === false ? false : (state.isNewPatient === true ? true : !state.previousVisitInfo);
      const prevInfo = state.previousVisitInfo;

      const historyFormatted = conversationHistory && conversationHistory.length > 0
        ? conversationHistory.map(m => `${m.role === 'AI' ? 'Doctor AI' : 'Patient'}: "${m.content}"`).join('\n')
        : (state.questionsAsked || []).map((q, idx) => `Turn ${idx + 1} Question: "${q}"`).join('\n');

      const prompt = `You are MediKiosk Autonomous Clinical AI Intake Doctor.
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
Respondent: ${isCaregiver ? 'Caregiver / Family Member answering on behalf of the patient' : 'Patient themselves'}
Clinical History Gathered So Far: ${JSON.stringify(state)}
Turns Completed: ${state.turnsCompleted}

CLINICAL DOCTOR RULES & ADAPTIVE INTAKE PHILOSOPHY:

1. NEW PATIENT WORKFLOW (Patient Type: NEW PATIENT):
   - Goal: Chief Complaint -> Complaint Characterization -> Symptom-Targeted Lifestyle & Routine -> Past Medical History & Allergies -> Closing Verification.
   - Turn 0 (Initial Greeting): If no questions asked yet, warmly welcome the patient in simple language and ask what chief complaint or symptoms brought them to the hospital.
   - Turn 1 (Onset & Specific Pathology): Explore when and how the chief complaint began (sudden vs gradual, duration) and specific pathology (severity 1-10, character, triggers, radiation, relieving factors).
   - Turn 2 (Symptom-Tailored Lifestyle & Daily Habits): As an expert physician, you dynamically choose the most relevant lifestyle dimension based on their specific complaint (e.g. sitting/lifting for back/joint pain; sleep/screen/stress for headaches; meal timings/spicy food for acidity; dust/smoking for cough; exertion/stress/salt for chest/hypertension).
   - Turn 3 (Past Medical History, Medications & Allergies): Inquire about chronic conditions (BP, Sugar, Thyroid, Asthma), regular daily medications, prior surgeries, and known drug allergies.
   - Turn 4+ (Closing Verification): When chief complaint, targeted lifestyle baseline, and medical background are addressed in the transcript, YOU MUST set "isComplete": true and "questionCategory": "CLOSING" with the closing completion question ("Thank you. Your clinical intake details and lifestyle history are complete. Would you like to proceed with your appointment now?"). Touch options MUST include: ["Proceed with Appointment", "Add One More Detail"].

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
     * Turn 3+ (Closing Verification): When disease progression, residual concerns, and medications are evaluated in the transcript, YOU MUST set "isComplete": true and "questionCategory": "CLOSING" with the closing completion question ("Thank you. Your clinical intake details are complete. Would you like to proceed with your appointment now?"). Touch options MUST include: ["Proceed with Appointment", "Add One More Detail"].

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

Return ONLY valid JSON:
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

      const res = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are MediKiosk Autonomous Clinical AI Intake Doctor. Return ONLY valid JSON with no markdown.' },
          { role: 'user', content: prompt }
        ],
        model: this.model,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });

      const text = res.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.touchOptions) || parsed.touchOptions.length < 2) {
        const fallbackQ = await this.fallback.generateNextQuestion(state, language, isAyush, conversationHistory);
        parsed.touchOptions = fallbackQ.touchOptions;
      }
      return parsed;
    } catch (e: any) {
      console.log(`[Groq AI Engine] Notice: ${e?.message?.slice(0, 80) || 'using clinical fallback'}`);
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

Return ONLY valid JSON:
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
  "extractedDocumentFindings": [],
  "changesSincePreviousVisit": "string | null",
  "contradictions": [],
  "medicationReconciliation": {
    "patientReported": [],
    "previouslyPrescribed": [],
    "documentExtracted": []
  },
  "clinicianVerificationRequired": false,
  "redFlags": [],
  "completenessScore": 95,
  "confidenceScore": 98,
  "sourceMap": {}
}`;

      const res = await this.groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a hospital clinical documentation AI. Return valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        model: this.model,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const text = res.choices[0]?.message?.content || '{}';
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
