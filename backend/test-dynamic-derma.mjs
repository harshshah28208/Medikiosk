import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

async function run() {
  const g = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log('Testing Groq live dynamic generation for Dermatology...');
  const res = await g.chat.completions.create({
    model: 'qwen/qwen3.8-27b',
    messages: [
      {
        role: 'system',
        content: 'You are MediKiosk Autonomous Clinical AI Intake Doctor. Return ONLY valid JSON: {"question": string, "touchOptions": string[]}'
      },
      {
        role: 'user',
        content: 'Doctor Specialty: Dermatology. Language: English. Generate the dynamic opening question and 4-5 touch options.'
      }
    ],
    response_format: { type: 'json_object' }
  });
  console.log('Result:', JSON.parse(res.choices[0].message.content));
}

run().catch(console.error);
