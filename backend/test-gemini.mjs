import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Using API Key:', apiKey ? 'Loaded' : 'Missing');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  
  const prompt = `You are MediKiosk Autonomous Clinical AI Intake Engine.
Patient Complaint: "Severe lower back pain radiating down the right leg with numbness"
Target Language: HI (Hindi)
Questions already asked: []
Turns: 1

Generate a clinical follow-up question in natural Hindi and return ONLY JSON:
{
  "question": "question in pure Hindi",
  "touchOptions": ["opt1 in Hindi", "opt2 in Hindi", "opt3 in Hindi"],
  "clinicalRationale": "Sciatic nerve compression screening"
}`;

  const res = await model.generateContent(prompt);
  console.log('\n--- LIVE GEMINI RESPONSE ---');
  console.log(res.response.text());
}

main().catch(console.error);
