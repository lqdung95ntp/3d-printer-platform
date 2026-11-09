import { describe, it, expect } from 'vitest';
import {
  isBambuPrinter,
  naturalCompare,
  defaultPrinterComparator,
  sortPrintersDefault,
  type PrinterLike,
} from '../../utils/printerSort';

describe('printerSort utility', () => {
  describe('isBambuPrinter', () => {
    it('returns true for bambu provider', () => {
      expect(isBambuPrinter({ provider: 'bambu' })).toBe(true);
      expect(isBambuPrinter({ provider: 'BAMBU' })).toBe(true);
    });

    it('returns true when provider is undefined or null', () => {
      expect(isBambuPrinter({})).toBe(true);
      expect(isBambuPrinter({ provider: null })).toBe(true);
      expect(isBambuPrinter({ provider: undefined })).toBe(true);
    });

    it('returns false for other providers', () => {
      expect(isBambuPrinter({ provider: 'klipper' })).toBe(false);
      expect(isBambuPrinter({ provider: 'elegoo_sdcp' })).toBe(false);
      expect(isBambuPrinter({ provider: 'prusalink' })).toBe(false);
      expect(isBambuPrinter({ provider: 'fluidd' })).toBe(false);
    });
  });

  describe('naturalCompare', () => {
    it('sorts numbers naturally', () => {
      const items = ['A1-10', 'A1-2', 'A1-1', 'A1-20', 'A1-3'];
      items.sort(naturalCompare);
      expect(items).toEqual(['A1-1', 'A1-2', 'A1-3', 'A1-10', 'A1-20']);
    });
  });

  describe('defaultPrinterComparator and sortPrintersDefault', () => {
    it('sorts Bambu Lab printers before non-Bambu Lab printers', () => {
      const printers: PrinterLike[] = [
        { id: 1, name: 'Ender 3', provider: 'klipper', model: 'Ender' },
        { id: 2, name: 'A1-1', provider: 'bambu', model: 'A1' },
      ];
      const sorted = sortPrintersDefault(printers);
      expect(sorted.map((p) => p.name)).toEqual(['A1-1', 'Ender 3']);
    });

    it('sorts by model, then by name with natural sorting', () => {
      // Exactly reproduces the user scenario from screenshot: A1-4, A1-3, A1-2, A1-1, A1-5
      const printers: PrinterLike[] = [
        { id: 1, name: 'A1-4', provider: 'bambu', model: 'A1' },
        { id: 2, name: 'A1-3', provider: 'bambu', model: 'A1' },
        { id: 3, name: 'A1-2', provider: 'bambu', model: 'A1' },
        { id: 4, name: 'A1-1', provider: 'bambu', model: 'A1' },
        { id: 5, name: 'A1-5', provider: 'bambu', model: 'A1' },
        { id: 6, name: 'P1S-2', provider: 'bambu', model: 'P1S' },
        { id: 7, name: 'P1S-1', provider: 'bambu', model: 'P1S' },
        { id: 8, name: 'A1 mini-1', provider: 'bambu', model: 'A1 mini' },
        { id: 9, name: 'Centauri-1', provider: 'elegoo_sdcp', model: 'Centauri Carbon' },
        { id: 10, name: 'Voron 2.4', provider: 'klipper', model: 'Voron' },
      ];

      const sorted = sortPrintersDefault(printers);
      expect(sorted.map((p) => p.name)).toEqual([
        'A1-1',
        'A1-2',
        'A1-3',
        'A1-4',
        'A1-5',
        'A1 mini-1',
        'P1S-1',
        'P1S-2',
        'Centauri-1',
        'Voron 2.4',
      ]);
    });

    it('sorts printers with missing models to the end of their provider group', () => {
      const printers: PrinterLike[] = [
        { id: 1, name: 'Unknown Bambu', provider: 'bambu', model: null },
        { id: 2, name: 'A1-1', provider: 'bambu', model: 'A1' },
        { id: 3, name: 'Klipper Known', provider: 'klipper', model: 'Voron' },
        { id: 4, name: 'Klipper Unknown', provider: 'klipper', model: null },
      ];

      const sorted = sortPrintersDefault(printers);
      expect(sorted.map((p) => p.name)).toEqual([
        'A1-1',
        'Unknown Bambu',
        'Klipper Known',
        'Klipper Unknown',
      ]);
    });

    it('breaks ties using ID', () => {
      const p1: PrinterLike = { id: 2, name: 'Same', model: 'A1', provider: 'bambu' };
      const p2: PrinterLike = { id: 1, name: 'Same', model: 'A1', provider: 'bambu' };
      expect(defaultPrinterComparator(p1, p2)).toBeGreaterThan(0);
      expect(defaultPrinterComparator(p2, p1)).toBeLessThan(0);
    });
  });
});

