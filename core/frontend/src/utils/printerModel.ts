import { isSnapmakerU1 } from './printerCamera';

// Map SSDP model codes to display names
export function mapModelCode(ssdpModel: string | null): string {
  if (!ssdpModel) return '';
  const modelMap: Record<string, string> = {
    // H2 Series
    'O1D': 'H2D',
    'O1E': 'H2D Pro',
    'O2D': 'H2D Pro',
    'O1C': 'H2C',
    'O1C2': 'H2C',
    'O1S': 'H2S',
    // X1 Series
    'BL-P001': 'X1C',
    'BL-P002': 'X1',
    'BL-P003': 'X1E',
    'C13': 'X1E',
    // X2 Series
    'N6': 'X2D',
    // A2 Series
    'N9': 'A2L',
    // P Series. A real P1P 3MF carries C11 next to "Bambu Lab P1P"; the
    // backend's PRINTER_MODEL_ID_MAP and the virtual printer use the same codes.
    'C11': 'P1P',
    'C12': 'P1S',
    'N7': 'P2S',
    // A1 Series
    'N2S': 'A1',
    'N1': 'A1 Mini',
    'A11': 'A1',
    'A12': 'A1 Mini',
    'A04': 'A1 Mini',
    // Direct matches
    'X1C': 'X1C',
    'X1': 'X1',
    'X1E': 'X1E',
    'X2D': 'X2D',
    'P1S': 'P1S',
    'P1P': 'P1P',
    'P2S': 'P2S',
    'A1': 'A1',
    'A1 Mini': 'A1 Mini',
    'A2L': 'A2L',
    'H2D': 'H2D',
    'H2D Pro': 'H2D Pro',
    'H2C': 'H2C',
    'H2S': 'H2S',
  };
  return modelMap[ssdpModel] || ssdpModel;
}

// Models that support Micro LiDAR / First Layer Inspection.
// Supported on X1 series (X1, X1C, X1E) and X2D.
// A-series (A1, A1 Mini, A2L) and P-series (P1P, P1S, P2S) do not have LiDAR.
const LAYER_INSPECT_MODELS = new Set([
  'X1',
  'X1C',
  'X1E',
  'X2D',
  'BLP001',
  'BLP002',
  'C13',
  'N6',
]);

export function supportsLayerInspect(model: string | null | undefined): boolean {
  if (!model) return false;
  const mapped = mapModelCode(model);
  let cleaned = (mapped || model).trim();
  if (cleaned.toLowerCase().startsWith('bambu lab ')) {
    cleaned = cleaned.slice(10).trim();
  }
  const normalized = cleaned.toUpperCase().replace(/[\s-]/g, '');
  if (
    normalized === 'X1CARBON' ||
    normalized === 'X1C' ||
    normalized === 'X1' ||
    normalized === 'X1E' ||
    normalized === 'X2D'
  ) {
    return true;
  }
  return LAYER_INSPECT_MODELS.has(normalized);
}

/**
 * Check if the printer model is Bambu Lab A1 (excluding A1 Mini).
 * Mirrors backend is_bambu_a1 in printer_models.py.
 */
export function isBambuA1(model: string | null | undefined): boolean {
  if (!model) return false;
  const mapped = mapModelCode(model);
  const normalized = (mapped || model).trim().toUpperCase().replace(/[\s-]/g, '');
  if (normalized.includes('MINI') || normalized === 'A12' || normalized === 'N1' || normalized === 'A04') {
    return false;
  }
  return (
    normalized.includes('A1') ||
    normalized === 'BAMBULABA1' ||
    normalized === 'BAMBUA1' ||
    normalized === 'N2S' ||
    normalized === 'A11'
  );
}

/**
 * Check if the printer supports on-device AI detection features
 * (spaghetti detection, build plate marker / detection, print monitoring).
 * Supported on Snapmaker U1 and Bambu X1 series / X2D.
 * Excludes Bambu A1 (which uses separate camera-based build plate presence checking).
 */
export function supportsAiDetection(
  model: string | null | undefined,
  name?: string | null | undefined
): boolean {
  if (isSnapmakerU1(model) || (name && isSnapmakerU1(name))) {
    return true;
  }
  if (supportsLayerInspect(model)) {
    return true;
  }
  return false;
}


