import prisma from '../config/db.js';
import { MRN_CONFIG, TOKEN_PREFIXES } from '../config/constants.js';

/**
 * Generate a unique Medical Record Number (MRN).
 * Format: MK-XXXXX (e.g., MK-1001, MK-1002)
 */
export async function generateMRN(): Promise<string> {
  const count = await prisma.patient.count();
  let candidate = `${MRN_CONFIG.PREFIX}-${(1000 + count + 1).toString()}`;
  let exists = await prisma.patient.findUnique({ where: { mrn: candidate } });
  
  if (exists) {
    candidate = `${MRN_CONFIG.PREFIX}-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
  }
  return candidate;
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
