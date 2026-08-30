import { describe, it, expect } from 'vitest';
import { RedFlagEngine } from './RedFlagEngine.js';

describe('RedFlagEngine - Context-Aware Clinical Safety Suite', () => {
  const dummyState: any = {
    chiefComplaint: '',
    chiefComplaintOriginal: '',
    language: 'EN',
  };

  describe('True Positive Emergency Scenarios', () => {
    it('should trigger alert for severe chest pain', () => {
      const alerts = RedFlagEngine.evaluate(dummyState, 'I have severe chest pain.');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toMatch(/CHEST_PAIN_ALERT|CARDIAC_EMERGENCY/);
    });

    it('should trigger critical cardiac alert for acute coronary syndrome with radiating pain', () => {
      const alerts = RedFlagEngine.evaluate(dummyState, 'I have crushing chest pain radiating to my left arm.');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('CARDIAC_EMERGENCY');
      expect(alerts[0].severity).toBe('CRITICAL');
    });

    it('should trigger neurological emergency alert for stroke (F.A.S.T.) symptoms', () => {
      const alerts = RedFlagEngine.evaluate(dummyState, 'I suddenly cannot move my right arm and my speech is slurred.');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('NEUROLOGICAL_EMERGENCY');
      expect(alerts[0].severity).toBe('CRITICAL');
    });

    it('should trigger respiratory emergency alert for acute respiratory failure', () => {
      const alerts = RedFlagEngine.evaluate(dummyState, 'I am having severe difficulty breathing and turning blue.');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('RESPIRATORY_EMERGENCY');
      expect(alerts[0].severity).toBe('CRITICAL');
    });

    it('should trigger hemorrhage alert for heavy active bleeding', () => {
      const alerts = RedFlagEngine.evaluate(dummyState, 'I am bleeding heavily.');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('HEMORRHAGE_EMERGENCY');
      expect(alerts[0].severity).toBe('CRITICAL');
    });
  });

  describe('False Positive Adversarial & Negation Filtering', () => {
    it('should NOT trigger alert for third-party phrase (friend)', () => {
      const alerts = RedFlagEngine.evaluate(dummyState, 'My friend had chest pain yesterday, but I feel fine.');
      expect(alerts.length).toBe(0);
    });

    it('should NOT trigger alert for third-party family history (father)', () => {
      const alerts = RedFlagEngine.evaluate(dummyState, 'My father had a heart attack last year.');
      expect(alerts.length).toBe(0);
    });

    it('should NOT trigger alert for historical past episodes', () => {
      const alerts = RedFlagEngine.evaluate(dummyState, 'I had chest pain last year, but today I just have mild fever.');
      expect(alerts.length).toBe(0);
    });

    it('should NOT trigger alert for direct negation ("do not have chest pain")', () => {
      const alerts = RedFlagEngine.evaluate(dummyState, 'I do not have chest pain.');
      expect(alerts.length).toBe(0);
    });

    it('should NOT trigger alert for multiple symptom denials ("No chest pain, no breathing difficulty")', () => {
      const alerts = RedFlagEngine.evaluate(dummyState, 'No chest pain, no breathing difficulty.');
      expect(alerts.length).toBe(0);
    });
  });

  describe('Multilingual Emergency Evaluation', () => {
    it('should trigger critical cardiac alert for Hindi chest pain with diaphoresis', () => {
      const alerts = RedFlagEngine.evaluate(dummyState, 'सीने में भारी दर्द और पसीना');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('CARDIAC_EMERGENCY');
    });

    it('should trigger critical cardiac alert for Gujarati chest pain with left arm radiation', () => {
      const alerts = RedFlagEngine.evaluate(dummyState, 'છાતીમાં દુખાવો અને ડાબા હાથમાં દુખાવો');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('CARDIAC_EMERGENCY');
    });
  });

  describe('Vitals Hemodynamic Instability Evaluation', () => {
    it('should trigger SEVERE_HYPOXIA when SpO2 is below 90%', () => {
      const alerts = RedFlagEngine.evaluateVitals({ spo2: 88 });
      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe('SEVERE_HYPOXIA');
      expect(alerts[0].severity).toBe('CRITICAL');
    });

    it('should trigger HYPERTENSIVE_CRISIS when BP is systolic >= 180 or diastolic >= 120', () => {
      const alerts = RedFlagEngine.evaluateVitals({ bpSystolic: 190, bpDiastolic: 110 });
      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe('HYPERTENSIVE_CRISIS');
      expect(alerts[0].severity).toBe('CRITICAL');
    });
  });
});
