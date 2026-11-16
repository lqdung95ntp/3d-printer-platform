import { describe, it, expect } from 'vitest';
import { isBambuA1, mapModelCode, supportsLayerInspect, supportsAiDetection } from '../../utils/printerModel';

describe('printerModel utils', () => {
  describe('isBambuA1', () => {
    it('returns true for Bambu Lab A1 variants', () => {
      expect(isBambuA1('A1')).toBe(true);
      expect(isBambuA1('Bambu Lab A1')).toBe(true);
      expect(isBambuA1('Bambu Lab A1 0.4 nozzle')).toBe(true);
      expect(isBambuA1('bambu lab a1')).toBe(true);
      expect(isBambuA1('A11')).toBe(true);
      expect(isBambuA1('N2S')).toBe(true);
    });

    it('returns false for A1 Mini variants', () => {
      expect(isBambuA1('A1 Mini')).toBe(false);
      expect(isBambuA1('Bambu Lab A1 Mini')).toBe(false);
      expect(isBambuA1('bambu lab a1 mini')).toBe(false);
      expect(isBambuA1('A12')).toBe(false);
      expect(isBambuA1('N1')).toBe(false);
      expect(isBambuA1('A04')).toBe(false);
    });

    it('returns false for other printer models', () => {
      expect(isBambuA1('X1C')).toBe(false);
      expect(isBambuA1('X1 Carbon')).toBe(false);
      expect(isBambuA1('P1S')).toBe(false);
      expect(isBambuA1('P1P')).toBe(false);
      expect(isBambuA1('A2L')).toBe(false);
      expect(isBambuA1('H2D')).toBe(false);
      expect(isBambuA1('Elegoo Centauri Carbon')).toBe(false);
      expect(isBambuA1('Snapmaker U1')).toBe(false);
      expect(isBambuA1(null)).toBe(false);
      expect(isBambuA1(undefined)).toBe(false);
      expect(isBambuA1('')).toBe(false);
    });
  });

  describe('mapModelCode', () => {
    it('maps SSDP codes to display names', () => {
      expect(mapModelCode('N2S')).toBe('A1');
      expect(mapModelCode('N1')).toBe('A1 Mini');
      expect(mapModelCode('BL-P001')).toBe('X1C');
      expect(mapModelCode('C12')).toBe('P1S');
    });
  });

  describe('supportsLayerInspect', () => {
    it('returns true for X1 and X2 series', () => {
      expect(supportsLayerInspect('X1C')).toBe(true);
      expect(supportsLayerInspect('X1')).toBe(true);
      expect(supportsLayerInspect('X2D')).toBe(true);
    });

    it('returns false for A and P series', () => {
      expect(supportsLayerInspect('A1')).toBe(false);
      expect(supportsLayerInspect('A1 Mini')).toBe(false);
      expect(supportsLayerInspect('P1S')).toBe(false);
    });
  });

  describe('supportsAiDetection', () => {
    it('returns true for Snapmaker U1 by model or name', () => {
      expect(supportsAiDetection('Snapmaker U1')).toBe(true);
      expect(supportsAiDetection('snapmaker-u1')).toBe(true);
      expect(supportsAiDetection('U1')).toBe(true);
      expect(supportsAiDetection('Custom Printer', 'Snapmaker U1 Farm #1')).toBe(true);
    });

    it('returns true for Bambu X1 and X2 series', () => {
      expect(supportsAiDetection('X1C')).toBe(true);
      expect(supportsAiDetection('X1 Carbon')).toBe(true);
      expect(supportsAiDetection('X1E')).toBe(true);
      expect(supportsAiDetection('X2D')).toBe(true);
    });

    it('returns false for Bambu A1 and P series (Plate Check is separate)', () => {
      expect(supportsAiDetection('A1')).toBe(false);
      expect(supportsAiDetection('Bambu Lab A1')).toBe(false);
      expect(supportsAiDetection('A1 Mini')).toBe(false);
      expect(supportsAiDetection('P1S')).toBe(false);
      expect(supportsAiDetection('P1P')).toBe(false);
      expect(supportsAiDetection(null)).toBe(false);
      expect(supportsAiDetection(undefined)).toBe(false);
    });
  });
});
