import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
import { getAIProvider } from './src/ai/AIProvider.js';

async function test() {
  const provider = getAIProvider();
  console.log('Testing Multilingual AI Translation...');

  const hindiQ = 'क्या आपको त्वचा पर लाल दाने, खुजली या मुँहासे हो रहे हैं?';
  const gujaratiQ = 'શું આપને ચામડી પર લાલ ચકામા, ખંજવાળ કે ખીલ જણાય છે?';

  const enFromHi = await provider.translateText(hindiQ, 'EN');
  const enFromGu = await provider.translateText(gujaratiQ, 'EN');
  const guFromHi = await provider.translateText(hindiQ, 'GU');
  const hiFromGu = await provider.translateText(gujaratiQ, 'HI');

  console.log('Hindi -> English:', enFromHi);
  console.log('Gujarati -> English:', enFromGu);
  console.log('Hindi -> Gujarati:', guFromHi);
  console.log('Gujarati -> Hindi:', hiFromGu);

  const hindiOpt = 'लाल खुजली वाले दाने या एग्जिमा के चकत्ते';
  const gujaratiOpt = 'ખીલ, ફોડલીઓ અને ચહેરા પર ડાઘ';

  console.log('Hindi Option -> English:', await provider.translateText(hindiOpt, 'EN'));
  console.log('Gujarati Option -> English:', await provider.translateText(gujaratiOpt, 'EN'));
}

test().catch(console.error);
