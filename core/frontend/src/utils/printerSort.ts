import type { Printer } from '../api/client';

export type PrinterLike = Pick<Printer, 'id' | 'name'> & Partial<Pick<Printer, 'model' | 'provider'>>;

/**
 * Check whether a printer is a Bambu Lab printer.
 * If provider is undefined, null, or 'bambu' (case-insensitive), it is treated as Bambu Lab.
 */
export function isBambuPrinter(printer: { provider?: string | null }): boolean {
  return !printer.provider || printer.provider.toLowerCase() === 'bambu';
}

/**
 * Natural comparator for strings (handles digits numerically e.g. "A1-1", "A1-2", "A1-10").
 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Default comparator for ordering printers:
 * 1. Bambu Lab printers first, non-Bambu Lab printers second.
 * 2. Model: case-insensitive natural sort (e.g. A1, A1 mini, P1P, P1S, X1C).
 *    Printers with missing/empty model are sorted last within their provider group.
 * 3. Name: natural sort (e.g. A1-1, A1-2, ..., A1-9, A1-10).
 * 4. Fallback to ID for deterministic ordering.
 */
export function defaultPrinterComparator<T extends PrinterLike>(a: T, b: T): number {
  // 1. Bambu Lab priority
  const aBambu = isBambuPrinter(a);
  const bBambu = isBambuPrinter(b);
  if (aBambu !== bBambu) {
    return aBambu ? -1 : 1;
  }

  // 2. Model ordering
  const aModel = (a.model || '').trim();
  const bModel = (b.model || '').trim();
  if (aModel && !bModel) return -1;
  if (!aModel && bModel) return 1;
  if (aModel && bModel) {
    const modelCmp = naturalCompare(aModel, bModel);
    if (modelCmp !== 0) return modelCmp;
  }

  // 3. Name ordering (natural sort)
  const nameCmp = naturalCompare(a.name || '', b.name || '');
  if (nameCmp !== 0) return nameCmp;

  // 4. Stable tie-breaker
  return (a.id || 0) - (b.id || 0);
}

/**
 * Sorts an array of printers using the default comparator.
 */
export function sortPrintersDefault<T extends PrinterLike>(printers: T[]): T[] {
  return [...printers].sort(defaultPrinterComparator);
}

