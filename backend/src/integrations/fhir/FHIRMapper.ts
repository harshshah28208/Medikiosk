/**
 * MediKiosk HL7 FHIR R4 Mapping Layer
 * Maps real MediKiosk database records into official HL7 FHIR R4 structured resources.
 * Strictly adheres to Ayushman Bharat Digital Mission (ABDM) FHIR Profiles.
 */

export interface FHIRResource {
  resourceType: string;
  id: string;
  [key: string]: any;
}

export class FHIRMapper {
  /**
   * Map Patient model to FHIR Patient Resource
   */
  static toFHIRPatient(patient: any): FHIRResource {
    return {
      resourceType: 'Patient',
      id: patient.id,
      identifier: [
        {
          system: 'https://healthid.ndhm.gov.in',
          value: patient.abhaId || undefined,
          type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }] }
        },
        {
          system: 'https://medikiosk.in/mrn',
          value: patient.mrn
        }
      ].filter(i => i.value),
      name: [
        {
          use: 'official',
          text: patient.name,
          family: patient.name.split(' ').slice(1).join(' ') || undefined,
          given: [patient.name.split(' ')[0]]
        }
      ],
      telecom: [
        { system: 'phone', value: patient.phone, use: 'mobile' },
        patient.email ? { system: 'email', value: patient.email } : null
      ].filter(Boolean),
      gender: (patient.gender || 'unknown').toLowerCase(),
      birthDate: patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().split('T')[0] : undefined,
      address: patient.address ? [{ text: patient.address }] : undefined,
      communication: [
        {
          language: {
            coding: [
              {
                system: 'urn:ietf:bcp:47',
                code: patient.preferredLang ? patient.preferredLang.toLowerCase() : 'en',
                display: patient.preferredLang === 'HI' ? 'Hindi' : patient.preferredLang === 'GU' ? 'Gujarati' : 'English'
              }
            ]
          },
          preferred: true
        }
      ]
    };
  }

  /**
   * Map Visit to FHIR Encounter Resource
   */
  static toFHIREncounter(visit: any, patient: any, doctor?: any): FHIRResource {
    return {
      resourceType: 'Encounter',
      id: visit.id,
      status: visit.status === 'COMPLETED' ? 'finished' : 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      },
      type: [
        {
          coding: [
            {
              system: 'https://medikiosk.in/visit-type',
              code: visit.visitType,
              display: visit.visitType === 'NEW' ? 'New Patient Intake' : 'Follow-up Consultation'
            }
          ]
        }
      ],
      subject: {
        reference: `Patient/${patient.id}`,
        display: patient.name
      },
      participant: doctor ? [
        {
          individual: {
            reference: `Practitioner/${doctor.id}`,
            display: doctor.name || doctor.user?.name
          }
        }
      ] : [],
      period: {
        start: new Date(visit.createdAt).toISOString(),
        end: visit.updatedAt ? new Date(visit.updatedAt).toISOString() : undefined
      },
      reasonCode: visit.reasonForVisit ? [
        {
          text: visit.reasonForVisit
        }
      ] : []
    };
  }

  /**
   * Map Vitals & Biometrics to FHIR Observation Resources
   */
  static toFHIRVitalObservations(vital: any, patientId: string, encounterId: string): FHIRResource[] {
    const observations: FHIRResource[] = [];
    const effectiveDateTime = vital.recordedAt ? new Date(vital.recordedAt).toISOString() : new Date().toISOString();

    // Blood Pressure
    if (vital.bpSystolic && vital.bpDiastolic) {
      observations.push({
        resourceType: 'Observation',
        id: `vital-bp-${vital.id}`,
        status: 'final',
        category: [
          {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }]
          }
        ],
        code: {
          coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel with all children optional' }],
          text: 'Blood Pressure'
        },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime,
        component: [
          {
            code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }] },
            valueQuantity: { value: vital.bpSystolic, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
          },
          {
            code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }] },
            valueQuantity: { value: vital.bpDiastolic, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
          }
        ]
      });
    }

    // Pulse / Heart Rate
    if (vital.pulse) {
      observations.push({
        resourceType: 'Observation',
        id: `vital-pulse-${vital.id}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
        code: { coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }], text: 'Pulse Rate' },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime,
        valueQuantity: { value: vital.pulse, unit: 'beats/min', system: 'http://unitsofmeasure.org', code: '/min' }
      });
    }

    // SpO2 (Oxygen Saturation)
    if (vital.spo2) {
      observations.push({
        resourceType: 'Observation',
        id: `vital-spo2-${vital.id}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
        code: { coding: [{ system: 'http://loinc.org', code: '2708-6', display: 'Oxygen saturation in Arterial blood by Pulse oximetry' }], text: 'SpO2' },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime,
        valueQuantity: { value: vital.spo2, unit: '%', system: 'http://unitsofmeasure.org', code: '%' }
      });
    }

    // Temperature
    if (vital.temperature) {
      observations.push({
        resourceType: 'Observation',
        id: `vital-temp-${vital.id}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
        code: { coding: [{ system: 'http://loinc.org', code: '8310-5', display: 'Body temperature' }], text: 'Body Temperature' },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime,
        valueQuantity: { value: vital.temperature, unit: '°F', system: 'http://unitsofmeasure.org', code: '[degF]' }
      });
    }

    return observations;
  }

  /**
   * Map Lab Results to FHIR Observation Resources
   */
  static toFHIRLabObservations(labResults: any[], patientId: string, encounterId: string): FHIRResource[] {
    return (labResults || []).map(lab => ({
      resourceType: 'Observation',
      id: `lab-${lab.id}`,
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
      code: { text: lab.testName },
      subject: { reference: `Patient/${patientId}` },
      encounter: { reference: `Encounter/${encounterId}` },
      effectiveDateTime: lab.testDate ? new Date(lab.testDate).toISOString() : new Date().toISOString(),
      valueString: `${lab.resultValue} ${lab.unit || ''}`.trim(),
      interpretation: lab.status && lab.status !== 'NORMAL' ? [
        {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: lab.status === 'HIGH' ? 'H' : lab.status === 'LOW' ? 'L' : 'A',
            display: lab.status
          }]
        }
      ] : undefined,
      referenceRange: lab.referenceRange ? [{ text: lab.referenceRange }] : undefined
    }));
  }

  /**
   * Map Allergies to FHIR AllergyIntolerance Resources
   */
  static toFHIRAllergies(allergies: any[], patientId: string): FHIRResource[] {
    return (allergies || []).map(a => ({
      resourceType: 'AllergyIntolerance',
      id: `allergy-${a.id}`,
      clinicalStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: (a.status || 'active').toLowerCase() }]
      },
      verificationStatus: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }]
      },
      category: ['medication'],
      criticality: a.severity === 'HIGH' || a.severity === 'SEVERE' ? 'high' : 'low',
      code: { text: a.allergen },
      patient: { reference: `Patient/${patientId}` },
      recordedDate: a.reportedAt ? new Date(a.reportedAt).toISOString() : new Date().toISOString(),
      reaction: a.reaction ? [{ manifestation: [{ text: a.reaction }] }] : undefined
    }));
  }

  /**
   * Map Prescriptions to FHIR MedicationRequest Resources
   */
  static toFHIRMedicationRequests(prescriptions: any[], patientId: string, encounterId: string): FHIRResource[] {
    const requests: FHIRResource[] = [];
    for (const rx of prescriptions || []) {
      for (const item of rx.items || []) {
        requests.push({
          resourceType: 'MedicationRequest',
          id: `medreq-${item.id}`,
          status: 'active',
          intent: 'order',
          medicationCodeableConcept: {
            text: `${item.medicineName} ${item.dosage || ''}`.trim()
          },
          subject: { reference: `Patient/${patientId}` },
          encounter: { reference: `Encounter/${encounterId}` },
          authoredOn: rx.createdAt ? new Date(rx.createdAt).toISOString() : new Date().toISOString(),
          dosageInstruction: [
            {
              text: `${item.frequency} for ${item.duration} (${item.instructions || 'As directed'})`,
              route: { text: item.route || 'Oral' }
            }
          ]
        });
      }
    }
    return requests;
  }

  /**
   * Build Complete FHIR R4 Bundle for an Encounter
   */
  static buildFHIRBundle(visit: any): FHIRResource {
    const patient = visit.patient;
    const entries: Array<{ fullUrl: string; resource: FHIRResource }> = [];

    // 1. Patient Resource
    const fhirPatient = this.toFHIRPatient(patient);
    entries.push({ fullUrl: `urn:uuid:${fhirPatient.id}`, resource: fhirPatient });

    // 2. Encounter Resource
    const fhirEncounter = this.toFHIREncounter(visit, patient, visit.doctor);
    entries.push({ fullUrl: `urn:uuid:${fhirEncounter.id}`, resource: fhirEncounter });

    // 3. Condition (Chief Complaint)
    if (visit.reasonForVisit || visit.clinicalHistory?.chiefComplaint) {
      const complaint = visit.clinicalHistory?.chiefComplaint || visit.reasonForVisit;
      entries.push({
        fullUrl: `urn:uuid:condition-${visit.id}`,
        resource: {
          resourceType: 'Condition',
          id: `condition-${visit.id}`,
          clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
          verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
          category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }] }],
          code: { text: complaint },
          subject: { reference: `Patient/${patient.id}` },
          encounter: { reference: `Encounter/${visit.id}` },
          recordedDate: new Date(visit.createdAt).toISOString()
        }
      });
    }

    // 4. Vitals Observations
    if (visit.vitals && visit.vitals.length > 0) {
      for (const v of visit.vitals) {
        const vObs = this.toFHIRVitalObservations(v, patient.id, visit.id);
        for (const obs of vObs) {
          entries.push({ fullUrl: `urn:uuid:${obs.id}`, resource: obs });
        }
      }
    }

    // 5. Lab Observations
    if (visit.labResults && visit.labResults.length > 0) {
      const labObs = this.toFHIRLabObservations(visit.labResults, patient.id, visit.id);
      for (const obs of labObs) {
        entries.push({ fullUrl: `urn:uuid:${obs.id}`, resource: obs });
      }
    }

    // 6. Allergies
    if (patient.allergies && patient.allergies.length > 0) {
      const allergies = this.toFHIRAllergies(patient.allergies, patient.id);
      for (const a of allergies) {
        entries.push({ fullUrl: `urn:uuid:${a.id}`, resource: a });
      }
    }

    // 7. Medication Requests
    if (visit.prescriptions && visit.prescriptions.length > 0) {
      const medReqs = this.toFHIRMedicationRequests(visit.prescriptions, patient.id, visit.id);
      for (const m of medReqs) {
        entries.push({ fullUrl: `urn:uuid:${m.id}`, resource: m });
      }
    }

    // 8. DocumentReference (Clinical Summary)
    if (visit.summary) {
      entries.push({
        fullUrl: `urn:uuid:summary-${visit.summary.id}`,
        resource: {
          resourceType: 'DocumentReference',
          id: `summary-${visit.summary.id}`,
          status: 'current',
          type: { coding: [{ system: 'http://loinc.org', code: '34133-9', display: 'Summary of episode note' }] },
          subject: { reference: `Patient/${patient.id}` },
          date: new Date(visit.summary.createdAt).toISOString(),
          description: 'MediKiosk Autonomous Clinical Intake Summary',
          content: [
            {
              attachment: {
                contentType: 'application/json',
                data: Buffer.from(visit.summary.summaryJson || '{}').toString('base64'),
                title: 'Structured Clinical Intake Summary'
              }
            }
          ]
        }
      });
    }

    return {
      resourceType: 'Bundle',
      id: `bundle-visit-${visit.id}`,
      meta: {
        lastUpdated: new Date().toISOString(),
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle']
      },
      identifier: {
        system: 'https://medikiosk.in/fhir/bundles',
        value: `MEDIKIOSK-BUNDLE-${visit.token || visit.id}`
      },
      type: 'document',
      timestamp: new Date().toISOString(),
      entry: entries
    };
  }
}
