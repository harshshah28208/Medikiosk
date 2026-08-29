import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config({ path: './backend/.env' });

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('API Key present:', Boolean(apiKey));
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });
  
  const prompt = `You are MediKiosk Clinical AI. Patient says: "I have severe lower back pain radiating down my right leg".
Target Language: HI (Hindi)
Respond with valid JSON:
{
  "question": "question in natural Hindi",
  "touchOptions": ["opt1", "opt2", "opt3"],
  "clinicalRationale": "reason"
}`;

  const res = await model.generateContent(prompt);
  console.log('Result:', res.response.text());
}

main().catch(console.error);
