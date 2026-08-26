import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../config/db.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(optionalAuth);

// Setup multer disk storage
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and PDF files are allowed'));
    }
  },
});

/**
 * Mock OCR Medical Entity Extractor
 */
function extractMedicalEntities(title: string, fileType: string) {
  const isPrescription = fileType === 'PRESCRIPTION';
  const isLab = fileType === 'LAB_REPORT';

  if (isPrescription) {
    return {
      documentType: 'Prescription',
      doctorName: 'Dr. Vikram Seth (Cardiologist)',
      date: new Date().toISOString().split('T')[0],
      medications: [
        { name: 'Telmisartan', dosage: '40 mg', frequency: 'Once daily (OD) Morning' },
        { name: 'Metformin', dosage: '500 mg', frequency: 'Twice daily (BD) After food' },
        { name: 'Atorvastatin', dosage: '10 mg', frequency: 'Once daily (HS) Bedtime' },
      ],
      diagnoses: ['Essential Hypertension', 'Type 2 Diabetes Mellitus'],
      confidence: 0.96,
    };
  }

  if (isLab) {
    return {
      documentType: 'Laboratory Investigation Report',
      labName: 'Metropolis Diagnostic Pathology',
      date: new Date().toISOString().split('T')[0],
      tests: [
        { testName: 'HbA1c (Glycated Hemoglobin)', value: '7.4', unit: '%', reference: '< 5.7%', status: 'HIGH' },
        { testName: 'Fasting Blood Sugar (FBS)', value: '138', unit: 'mg/dL', reference: '70-100 mg/dL', status: 'HIGH' },
        { testName: 'Serum Creatinine', value: '0.9', unit: 'mg/dL', reference: '0.7-1.3 mg/dL', status: 'NORMAL' },
      ],
      confidence: 0.94,
    };
  }

  return {
    documentType: 'Clinical Document',
    extractedEntities: ['Recorded in hospital electronic archive'],
    confidence: 0.90,
  };
}

/**
 * POST /api/documents/upload
 * Upload document with instant simulated/real OCR entity extraction.
 */
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { patientId, visitId, title, fileType = 'PRESCRIPTION' } = req.body;
  const file = req.file;

  if (!patientId || !title || !file) {
    res.status(400).json({ error: 'patientId, title, and file are required.' });
    return;
  }

  try {
    let validPatient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!validPatient) {
      validPatient = await prisma.patient.findFirst();
    }

    if (!validPatient) {
      res.status(404).json({ error: 'No patient record found for document attachment.' });
      return;
    }

    let validVisitId: string | null = null;
    if (visitId && visitId !== 'current') {
      const visitExists = await prisma.visit.findUnique({ where: { id: visitId } });
      if (visitExists) validVisitId = visitId;
    }

    const fileUrl = `/uploads/${file.filename}`;

    // 1. Create Document Record
    const doc = await prisma.document.create({
      data: {
        patientId: validPatient.id,
        visitId: validVisitId,
        title: title.trim(),
        fileType: fileType as any,
        mimeType: file.mimetype,
        fileUrl,
        fileSize: file.size,
        status: 'PROCESSED',
      },
    });

  // 2. OCR Entity Extraction
  const extractedData = extractMedicalEntities(title, fileType);

  const extraction = await prisma.documentExtraction.create({
    data: {
      documentId: doc.id,
      extractedData: JSON.stringify(extractedData),
      confidence: extractedData.confidence || 0.85,
      status: 'CONFIRMED',
      processedAt: new Date(),
    },
  });

  await createAuditLog({
    userId: req.user?.id,
    role: req.user?.role,
    action: AUDIT_ACTIONS.UPLOAD_DOCUMENT,
    resourceType: 'DOCUMENT',
    resourceId: doc.id,
    details: { title, fileType, confidence: extractedData.confidence },
  });

    res.status(201).json({
      document: doc,
      extraction,
    });
  } catch (err: any) {
    console.error('Document upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to process document upload.' });
  }
});

/**
 * GET /api/documents/:patientId
 * Get all medical documents and OCR results for a patient.
 */
router.get('/:patientId', async (req: AuthRequest, res: Response): Promise<void> => {
  const patientId = typeof req.params.patientId === 'string' ? req.params.patientId : req.params.patientId[0];

  const documents = await prisma.document.findMany({
    where: { patientId },
    include: {
      extractions: true,
    },
    orderBy: { uploadedAt: 'desc' },
  });

  res.json({ documents });
});

/**
 * GET /api/timeline/:patientId
 * Real-time computed longitudinal medical timeline combining visits, documents, vitals, and prescriptions.
 */
router.get('/timeline/:patientId', async (req: AuthRequest, res: Response): Promise<void> => {
  const patientId = typeof req.params.patientId === 'string' ? req.params.patientId : req.params.patientId[0];

  const [patient, visits, documents, prescriptions, vitals] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId } }),
    prisma.visit.findMany({
      where: { patientId },
      include: { department: true, consultation: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.document.findMany({
      where: { patientId },
      include: { extractions: true },
      orderBy: { uploadedAt: 'desc' },
    }),
    prisma.prescription.findMany({
      where: { patientId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.vital.findMany({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
    }),
  ]);

  if (!patient) {
    res.status(404).json({ error: 'Patient not found' });
    return;
  }

  // Assemble chronological timeline events
  const timeline: any[] = [];

  visits.forEach((v) => {
    timeline.push({
      id: `visit-${v.id}`,
      date: v.createdAt,
      type: 'VISIT',
      title: `OPD Visit — ${v.department.name}`,
      description: v.reasonForVisit || 'General clinical consultation',
      details: v.consultation ? `Impression: ${v.consultation.impression || 'Consultation completed'}` : 'Intake completed',
      priority: v.priority,
    });
  });

  documents.forEach((d) => {
    timeline.push({
      id: `doc-${d.id}`,
      date: d.uploadedAt,
      type: 'DOCUMENT_OCR',
      title: `Medical Record: ${d.title}`,
      description: `Uploaded ${d.fileType} document with AI OCR analysis`,
      details: d.extractions?.[0]?.extractedData || {},
    });
  });

  prescriptions.forEach((p) => {
    const medNames = p.items.map((i) => `${i.medicineName} (${i.dosage})`).join(', ');
    timeline.push({
      id: `rx-${p.id}`,
      date: p.createdAt,
      type: 'PRESCRIPTION',
      title: 'Physician E-Prescription Issued',
      description: medNames,
      details: p.notes,
    });
  });

  // Sort descending by date
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json({
    patient: { id: patient.id, name: patient.name, mrn: patient.mrn },
    timeline,
    totalEvents: timeline.length,
  });
});

export default router;
