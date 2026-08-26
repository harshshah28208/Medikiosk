import prisma from '../config/db.js';
import { MRN_CONFIG, TOKEN_PREFIXES } from '../config/constants.js';

/**
 * Generate a unique Medical Record Number (MRN).
 * Format: MK-XXXXX (e.g., MK-1001, MK-1002)
 */
export async function generateMRN(): Promise<string> {
  // Find the highest existing MRN number
  const lastPatient = await prisma.patient.findFirst({
    where: {
      mrn: { startsWith: MRN_CONFIG.PREFIX },
    },
    orderBy: { createdAt: 'desc' },
    select: { mrn: true },
  });

  let nextNumber = MRN_CONFIG.LIVE_START;

  if (lastPatient) {
    const currentNumber = parseInt(lastPatient.mrn.split('-')[1], 10);
    if (currentNumber >= MRN_CONFIG.LIVE_START) {
      nextNumber = currentNumber + 1;
    }
  }

  return `${MRN_CONFIG.PREFIX}-${nextNumber.toString().padStart(4, '0')}`;
}

/**
 * Generate a unique queue token number for a department.
 * Format: DEPT_PREFIX-NNN (e.g., C-101, G-201)
 */
export async function generateToken(departmentCode: string): Promise<string> {
  const prefix = TOKEN_PREFIXES[departmentCode] || TOKEN_PREFIXES.DEFAULT;

  // Count today's visits for this department to generate sequential token
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCount = await prisma.visit.count({
    where: {
      department: { code: departmentCode },
      createdAt: { gte: today },
    },
  });

  const tokenNumber = todayCount + 101; // Start from 101
  return `${prefix}-${tokenNumber}`;
}
