import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
import { getAIProvider } from './src/ai/AIProvider.js';

async function test() {
  const provider = getAIProvider();
  console.log('Testing Groq AI directly for dandruff & hair fall...');

  const state = {
    chiefComplaint: 'Heavy white dandruff flakes and severe scalp itching with hair fall',
    latestAnswer: 'I have heavy white dandruff flakes and severe scalp itching with hair fall',
    turnsCompleted: 1,
    questionsAsked: ['Welcome to Dermatology. What brings you in today?'],
    carePath: 'ALLOPATHY',
    specialty: 'Dermatology',
  };

  const q = await provider.generateNextQuestion(state, 'EN', 'ALLOPATHY', 'Dermatology', [
    { role: 'AI', content: 'Welcome to Dermatology. What brings you in today?' },
    { role: 'Patient', content: 'I have heavy white dandruff flakes and severe scalp itching with hair fall' },
  ]);

  console.log('Resulting AI Question:');
  console.log(JSON.stringify(q, null, 2));
}

test().catch(console.error);
