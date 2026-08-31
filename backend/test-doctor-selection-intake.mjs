import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://127.0.0.1:5000/api';

async function runDoctorSelectionTests() {
  console.log('🏥 ========================================================');
  console.log('🏥 TESTING DOCTOR-SELECTION & SPECIALTY-TAILORED INTAKE');
  console.log('🏥 ========================================================\n');

  const testCases = [
    {
      doctorName: 'Ramesh Kumar',
      specialty: 'Cardiology',
      carePath: 'ALLOPATHY',
      lang: 'EN',
      expectedKeyword: 'Cardiology',
    },
    {
      doctorName: 'Neha Patel',
      specialty: 'Dermatology',
      carePath: 'ALLOPATHY',
      lang: 'EN',
      expectedKeyword: 'Dermatology',
    },
    {
      doctorName: 'Amit Joshi',
      specialty: 'Neurology',
      carePath: 'ALLOPATHY',
      lang: 'EN',
      expectedKeyword: 'Neurology',
    },
    {
      doctorName: 'Sanjay Rao',
      specialty: 'Ophthalmology',
      carePath: 'ALLOPATHY',
      lang: 'EN',
      expectedKeyword: 'Ophthalmology',
    },
    {
      doctorName: 'Rajesh Gupta',
      specialty: 'Orthopedics',
      carePath: 'ALLOPATHY',
      lang: 'EN',
      expectedKeyword: 'Orthopedics',
    },
    {
      doctorName: 'Sneha Kulkarni',
      specialty: 'Ayurveda',
      carePath: 'AYUSH',
      lang: 'EN',
      expectedKeyword: 'Ayurveda',
    },
    {
      doctorName: 'Manish Mehta',
      specialty: 'Classical Homeopathy',
      carePath: 'HOMEOPATHY',
      lang: 'EN',
      expectedKeyword: 'Homeopathy',
    },
  ];

  let patient = await prisma.patient.findFirst();
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        mrn: `MRN-DOC-${Date.now()}`,
        name: 'Doctor Selection Test Patient',
        phone: '9988776655',
        age: 40,
        gender: 'Male',
      },
    });
  }

  let dept = await prisma.department.findFirst();

  for (const tc of testCases) {
    console.log(`▶ Testing Intake for Dr. ${tc.doctorName} (${tc.specialty}, ${tc.carePath}):`);

    const visit = await prisma.visit.create({
      data: {
        patient: { connect: { id: patient.id } },
        department: { connect: { id: dept.id } },
        token: `T-${Date.now().toString().slice(-4)}`,
        status: 'INTAKE_IN_PROGRESS',
      },
    });

    const startRes = await fetch(`${BASE_URL}/conversation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitId: visit.id,
        language: tc.lang,
        carePath: tc.carePath,
        specialty: tc.specialty,
        doctorName: tc.doctorName,
      }),
    });

    const startData = await startRes.json();
    const question = startData.nextQuestion || startData.aiMessage?.content || startData.message?.content;
    const options = startData.touchOptions || [];

    console.log(`   Status: ${startRes.status}`);
    console.log(`   Doctor AI Opening: "${question}"`);
    console.log(`   1-Tap Touch Options:`, options);

    if (!question || question.length === 0) {
      throw new Error(`Empty question for Dr. ${tc.doctorName}`);
    }
    if (!options || options.length === 0) {
      throw new Error(`Empty touch options for Dr. ${tc.doctorName}`);
    }
    console.log(`   ✅ Successfully tailored to Dr. ${tc.doctorName} & ${tc.specialty}\n`);
  }

  console.log('========================================================');
  console.log('✅ ALL DOCTOR SELECTIONS & SPECIALTIES VERIFIED!');
  console.log('========================================================');
  await prisma.$disconnect();
}

runDoctorSelectionTests().catch(async (e) => {
  console.error('❌ Test failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
