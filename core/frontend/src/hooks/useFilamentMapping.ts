import { useMemo } from 'react';
import { getColorName } from '../utils/colors';
import type { RackGroupInfo } from '../components/PrintModal/types';
import {
  normalizeColor,
  normalizeColorForCompare,
  coloursMatch,
  colorDistance,
  filamentTypesCompatible,
  findNearestSimilar,
  formatSlotLabel,
  getGlobalTrayId,
  preferLowestSortKey,
  compareSortKeys,
} from '../utils/amsHelpers';
import type { PrinterStatus, SlotSpoolIdentity, SpoolAssignment } from '../api/client';

/** Global-tray-id → the identity of the spool Bambuddy has bound to that slot. */
export type SlotSpoolIdentities = Map<number, SlotSpoolIdentity>;

/**
 * Name a slot after the spool bound to it, the way the printer card does.
 */
function spoolDisplayName(identity: SlotSpoolIdentity | undefined): string | null {
  if (!identity) return null;
  const parts = [identity.brand, identity.material, identity.subtype].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

export function assignmentsToSlotSpools(
  assignments: SpoolAssignment[] | undefined,
  printerId?: number,
): SlotSpoolIdentities | undefined {
  if (!assignments?.length) return undefined;
  const map: SlotSpoolIdentities = new Map();
  for (const assignment of assignments) {
    if (printerId != null && assignment.printer_id !== printerId) continue;
    const spool = assignment.spool;
    if (!spool) continue;
    const isExternal = assignment.ams_id === 255;
    const gtid = getGlobalTrayId(assignment.ams_id, assignment.tray_id, isExternal);
    map.set(gtid, {
      brand: spool.brand,
      material: spool.material,
      subtype: spool.subtype,
      color_name: spool.color_name,
      rgba: spool.rgba,
      extra_colors: spool.extra_colors,
      effect_type: spool.effect_type,
    });
  }
  return map.size > 0 ? map : undefined;
}

export function assignmentsToInventoryRemainMap(
  assignments: SpoolAssignment[] | undefined,
  printerId?: number,
): Map<number, number> | undefined {
  if (!assignments?.length) return undefined;
  const map = new Map<number, number>();
  for (const assignment of assignments) {
    if (printerId != null && assignment.printer_id !== printerId) continue;
    const spool = assignment.spool;
    if (!spool) continue;
    const isExternal = assignment.ams_id === 255;
    if (isExternal) continue;
    const gtid = getGlobalTrayId(assignment.ams_id, assignment.tray_id, false);
    const remaining = Math.max(0, (spool.label_weight ?? 0) - (spool.weight_used ?? 0));
    map.set(gtid, remaining);
  }
  return map.size > 0 ? map : undefined;
}

/**
 * Build loaded filaments list from printer status (non-hook version).
 * Extracts filaments from all AMS units (regular and HT) and external spool.
 */
export function buildLoadedFilaments(
  printerStatus: PrinterStatus | undefined,
  slotSpoolsOrAssignments?: SlotSpoolIdentities | SpoolAssignment[],
  printerId?: number,
): LoadedFilament[] {
  const filaments: LoadedFilament[] = [];
  const amsExtruderMap = printerStatus?.ams_extruder_map;
  const assignments = Array.isArray(slotSpoolsOrAssignments) ? slotSpoolsOrAssignments : undefined;
  const slotSpools = slotSpoolsOrAssignments instanceof Map
    ? slotSpoolsOrAssignments
    : assignmentsToSlotSpools(assignments, printerId);

  const hasDualNozzle =
    Boolean(printerStatus?.nozzles?.[1]?.nozzle_diameter)
    || (printerStatus?.vt_tray?.length ?? 0) > 1;

  // Add filaments from all AMS units (regular and HT)
  const hasAms = (printerStatus?.ams?.length ?? 0) > 0;
  printerStatus?.ams?.forEach((amsUnit) => {
    const isHt = amsUnit.tray.length === 1; // AMS-HT has single tray
    const isSnapmakerU1 = (amsUnit as { module_type?: string }).module_type === 'snapmaker_u1';
    amsUnit.tray.forEach((tray) => {
      if (tray.tray_type) {
        const color = normalizeColor(tray.tray_color);
        const globalTrayId = getGlobalTrayId(amsUnit.id, tray.id, false);
        const identity = slotSpools?.get(globalTrayId);
        filaments.push({
          type: tray.tray_type,
          color,
          colorName: identity?.color_name?.trim() || getColorName(color, tray.tray_sub_brands),
          amsId: amsUnit.id,
          trayId: tray.id,
          isHt,
          isExternal: false,
          label: isSnapmakerU1 ? `E${tray.id + 1}` : formatSlotLabel(amsUnit.id, tray.id, isHt, false),
          globalTrayId,
          trayInfoIdx: tray.tray_info_idx || '',
          traySubBrands: tray.tray_sub_brands || '',
          spoolName: spoolDisplayName(identity) ?? undefined,
          extraColors: identity?.extra_colors ?? undefined,
          effectType: identity?.effect_type ?? undefined,
          spoolSubtype: identity?.subtype ?? undefined,
          extruderId: amsExtruderMap?.[String(amsUnit.id)],
          remain: tray.remain ?? -1,
        });
      }
    });
  });

  // Add external spool(s) if loaded and printer has no AMS.
  if (!hasAms) {
    for (const extTray of printerStatus?.vt_tray ?? []) {
      if (extTray.tray_type) {
        const color = normalizeColor(extTray.tray_color);
        const trayId = extTray.id ?? 254;
        const hasDualExternal = (printerStatus?.vt_tray?.length ?? 0) > 1;
        const identity = slotSpools?.get(trayId);
        filaments.push({
          type: extTray.tray_type,
          color,
          colorName: identity?.color_name?.trim() || getColorName(color, extTray.tray_sub_brands),
          amsId: -1,
          trayId: trayId - 254,
          isHt: false,
          isExternal: true,
          label: hasDualExternal ? (trayId === 254 ? 'Ext-L' : 'Ext-R') : 'External',
          globalTrayId: trayId,
          trayInfoIdx: extTray.tray_info_idx || '',
          traySubBrands: extTray.tray_sub_brands || '',
          spoolName: spoolDisplayName(identity) ?? undefined,
          extraColors: identity?.extra_colors ?? undefined,
          effectType: identity?.effect_type ?? undefined,
          spoolSubtype: identity?.subtype ?? undefined,
          extruderId: hasDualNozzle ? (255 - trayId) : undefined,
          remain: extTray.remain ?? -1,
        });
      }
    }
  }

  // Fallback external slot from inventory assignments for non-Bambu / non-AMS printers
  if (!hasAms && assignments) {
    for (const assignment of assignments) {
      if (printerId != null && assignment.printer_id !== printerId) continue;
      const spool = assignment.spool;
      if (!spool) continue;

      const isExternal = assignment.ams_id === 255;
      if (!isExternal) continue;

      const globalTrayId = getGlobalTrayId(assignment.ams_id, assignment.tray_id, isExternal);
      if (filaments.some((f) => f.globalTrayId === globalTrayId)) continue;

      const color = normalizeColor(spool.rgba || assignment.fingerprint_color || '#CCCCCC');
      const remaining = spool.label_weight > 0
        ? Math.max(0, Math.round(((spool.label_weight - spool.weight_used) / spool.label_weight) * 100))
        : -1;
      const trayLabel = assignment.tray_id === 1 ? 'Ext-R' : 'External';

      filaments.push({
        type: spool.material || assignment.fingerprint_type || '',
        color,
        colorName: spool.color_name || getColorName(color),
        amsId: -1,
        trayId: assignment.tray_id,
        isHt: false,
        isExternal: true,
        label: trayLabel,
        globalTrayId,
        trayInfoIdx: spool.slicer_filament || '',
        traySubBrands: spool.slicer_filament_name || spool.subtype || '',
        spoolName: [spool.brand, spool.material, spool.subtype].filter(Boolean).join(' ') || undefined,
        extraColors: spool.extra_colors ?? undefined,
        effectType: spool.effect_type ?? undefined,
        spoolSubtype: spool.subtype ?? undefined,
        remain: remaining,
      });
    }
  }

  return filaments;
}

/**
 * Compute AMS mapping for a printer given filament requirements and printer status.
 */
export function computeAmsMapping(
  filamentReqs: { filaments: FilamentRequirement[] } | undefined,
  printerStatus: PrinterStatus | undefined,
  preferLowest?: boolean,
  inventoryByTrayIdOrAssignments?: Map<number, number> | SpoolAssignment[],
  printerId?: number,
): number[] | undefined {
  const assignments = Array.isArray(inventoryByTrayIdOrAssignments) ? inventoryByTrayIdOrAssignments : undefined;
  const inventoryByTrayId = inventoryByTrayIdOrAssignments instanceof Map
    ? inventoryByTrayIdOrAssignments
    : assignmentsToInventoryRemainMap(assignments, printerId);
  const loadedFilaments = buildLoadedFilaments(printerStatus, assignments, printerId);
  if (loadedFilaments.length === 0) return undefined;

  const ftsActive = printerStatus?.fila_switch?.installed === true;

  return buildAmsMapping(
    buildFilamentComparison(filamentReqs, loadedFilaments, {}, preferLowest, inventoryByTrayId, ftsActive),
  );
}

export interface LoadedFilament {
  type: string;
  color: string;
  colorName: string;
  amsId: number;
  trayId: number;
  isHt: boolean;
  isExternal: boolean;
  label: string;
  globalTrayId: number;
  /** Unique spool identifier (e.g., "GFA00", "P4d64437") */
  trayInfoIdx?: string;
  /** Filament subtype name (e.g., "PLA Basic", "PLA Matte", "PETG HF") */
  traySubBrands?: string;
  /** "Devil Design PLA Basic" — the spool Bambuddy has bound to this slot */
  spoolName?: string;
  /** Extruder ID for dual-nozzle printers (0=right, 1=left) */
  extruderId?: number;
  /** Remaining filament percentage (0-100), -1 = unknown */
  remain: number;
  extraColors?: string;
  effectType?: string;
  spoolSubtype?: string;
}

/**
 * Represents a required filament from the 3MF file.
 */
export interface FilamentRequirement {
  slot_id: number;
  type: string;
  color: string;
  used_grams: number;
  /** Unique spool identifier from slicing (e.g., "GFA00", "P4d64437") */
  tray_info_idx?: string;
  /** Target nozzle for dual-nozzle printers (0=right, 1=left) */
  nozzle_id?: number;
  group_id?: number;
  group?: RackGroupInfo;
}

/**
 * Status of filament comparison between required and loaded.
 */
export type FilamentStatus = 'match' | 'type_only' | 'mismatch' | 'empty';

/**
 * Result of comparing a required filament with loaded filaments.
 */
export interface FilamentComparison extends FilamentRequirement {
  loaded: LoadedFilament | undefined;
  hasFilament: boolean;
  typeMatch: boolean;
  colorMatch: boolean;
  status: FilamentStatus;
  isManual: boolean;
}

export interface FilamentRequirementsResponse {
  filaments: FilamentRequirement[];
}

interface UseFilamentMappingResult {
  /** List of all filaments loaded in the printer */
  loadedFilaments: LoadedFilament[];
  /** Comparison results for each required filament */
  filamentComparison: FilamentComparison[];
  /** AMS mapping array for the print command */
  amsMapping: number[] | undefined;
  /** Whether any required filament type is not loaded */
  hasTypeMismatch: boolean;
  /** Whether any required filament has a color mismatch */
  hasColorMismatch: boolean;
}

/**
 * Hook to build loaded filaments list from printer status.
 */
export function useLoadedFilaments(
  printerStatus: PrinterStatus | undefined,
  slotSpoolsOrAssignments?: SlotSpoolIdentities | SpoolAssignment[],
  printerId?: number,
): LoadedFilament[] {
  return useMemo(() => {
    return buildLoadedFilaments(printerStatus, slotSpoolsOrAssignments, printerId);
  }, [printerStatus, slotSpoolsOrAssignments, printerId]);
}

/**
 * Compare required filaments with loaded filaments (non-hook version).
 */
export function buildFilamentComparison(
  filamentReqs: FilamentRequirementsResponse | undefined,
  loadedFilaments: LoadedFilament[],
  manualMappings: Record<number, number>,
  preferLowest?: boolean,
  inventoryByTrayId?: Map<number, number>,
  ftsActive = false,
): FilamentComparison[] {
  if (!filamentReqs?.filaments || filamentReqs.filaments.length === 0) return [];

  // Track which trays have been assigned to avoid duplicates
  const usedTrayIds = new Set<number>();
  const resultMap = new Map<number, FilamentComparison>();

  // Pass 0: Apply manual overrides first
  filamentReqs.filaments.forEach((req, reqIdx) => {
    const slotId = req.slot_id || 0;
    if (slotId > 0 && manualMappings[slotId] !== undefined) {
      const manualTrayId = manualMappings[slotId];
      const manualLoaded = loadedFilaments.find((f) => f.globalTrayId === manualTrayId);

      if (manualLoaded) {
        usedTrayIds.add(manualLoaded.globalTrayId);
        const typeMatch = filamentTypesCompatible(manualLoaded.type, req.type);
        const colorMatch = coloursMatch(manualLoaded.color, req.color);

        let status: FilamentStatus;
        if (typeMatch && colorMatch) {
          status = 'match';
        } else if (typeMatch) {
          status = 'type_only';
        } else {
          status = 'mismatch';
        }

        resultMap.set(reqIdx, {
          ...req,
          loaded: manualLoaded,
          hasFilament: true,
          typeMatch,
          colorMatch,
          status,
          isManual: true,
        });
      }
    }
  });

  // Helper to get available candidate trays for a requirement
  const getAvailableTrays = (req: FilamentRequirement) => {
    let available = loadedFilaments.filter((f) => !usedTrayIds.has(f.globalTrayId));

    if (req.nozzle_id != null && !ftsActive) {
      available = available.filter((f) => f.extruderId === req.nozzle_id);
    }

    if (preferLowest) {
      available = [...available].sort((a, b) =>
        compareSortKeys(
          preferLowestSortKey(a, inventoryByTrayId),
          preferLowestSortKey(b, inventoryByTrayId),
        ),
      );
    }

    return available;
  };

  // Pass 1: Exact Type + Color match (prioritizing matching tray_info_idx if multiple)
  filamentReqs.filaments.forEach((req, reqIdx) => {
    if (resultMap.has(reqIdx)) return;

    const available = getAvailableTrays(req);
    const reqColor = req.color;
    const reqTii = req.tray_info_idx;

    const colorMatches = available.filter((f) => {
      if (!filamentTypesCompatible(f.type, req.type)) return false;
      if (!reqColor) return true;
      const isExactHex = normalizeColorForCompare(f.color) === normalizeColorForCompare(reqColor);
      if (isExactHex) return true;
      if (reqTii && f.trayInfoIdx === reqTii && coloursMatch(f.color, reqColor)) return true;
      return false;
    });

    if (colorMatches.length > 0) {
      colorMatches.sort((a, b) => {
        const score = (f: LoadedFilament) => {
          const exactHex = !reqColor || normalizeColorForCompare(f.color) === normalizeColorForCompare(reqColor);
          const idxMatch = reqTii && f.trayInfoIdx === reqTii;
          if (exactHex && idxMatch) return 1;
          if (idxMatch) return 2;
          if (exactHex) return 3;
          return 4;
        };
        const scoreDiff = score(a) - score(b);
        if (scoreDiff !== 0) return scoreDiff;
        const distA = reqColor ? colorDistance(a.color, reqColor) ?? Infinity : 0;
        const distB = reqColor ? colorDistance(b.color, reqColor) ?? Infinity : 0;
        return distA - distB;
      });

      const chosen = colorMatches[0];
      usedTrayIds.add(chosen.globalTrayId);
      const isColorMatch = coloursMatch(chosen.color, req.color);
      resultMap.set(reqIdx, {
        ...req,
        loaded: chosen,
        hasFilament: true,
        typeMatch: true,
        colorMatch: isColorMatch,
        status: isColorMatch ? 'match' : 'type_only',
        isManual: false,
      });
    }
  });

  // Pass 2: Exact Type + Similar Color match (findNearestSimilar / coloursMatch)
  filamentReqs.filaments.forEach((req, reqIdx) => {
    if (resultMap.has(reqIdx)) return;

    const available = getAvailableTrays(req);
    const typeMatches = available.filter((f) => filamentTypesCompatible(f.type, req.type));

    const chosen = findNearestSimilar(typeMatches, req.color, (f) => f.color);
    if (chosen) {
      usedTrayIds.add(chosen.globalTrayId);
      const colorMatch = coloursMatch(chosen.color, req.color);
      resultMap.set(reqIdx, {
        ...req,
        loaded: chosen,
        hasFilament: true,
        typeMatch: true,
        colorMatch,
        status: colorMatch ? 'match' : 'type_only',
        isManual: false,
      });
    }
  });

  // Pass 3: Exact Type + Matching tray_info_idx (Variant match fallback, e.g. Basic vs Matte)
  filamentReqs.filaments.forEach((req, reqIdx) => {
    if (resultMap.has(reqIdx)) return;
    if (!req.tray_info_idx) return;

    const available = getAvailableTrays(req);
    const variantMatches = available.filter(
      (f) => filamentTypesCompatible(f.type, req.type) && f.trayInfoIdx === req.tray_info_idx,
    );

    if (variantMatches.length > 0) {
      const chosen = variantMatches[0];
      usedTrayIds.add(chosen.globalTrayId);
      const colorMatch = coloursMatch(chosen.color, req.color);
      resultMap.set(reqIdx, {
        ...req,
        loaded: chosen,
        hasFilament: true,
        typeMatch: true,
        colorMatch,
        status: colorMatch ? 'match' : 'type_only',
        isManual: false,
      });
    }
  });

  // Pass 4: Compatible Type Only (Fallback)
  filamentReqs.filaments.forEach((req, reqIdx) => {
    if (resultMap.has(reqIdx)) return;

    const available = getAvailableTrays(req);
    const typeMatches = available.filter((f) => filamentTypesCompatible(f.type, req.type));

    if (typeMatches.length > 0) {
      if (req.color) {
        typeMatches.sort((a, b) => {
          const distA = colorDistance(a.color, req.color) ?? Infinity;
          const distB = colorDistance(b.color, req.color) ?? Infinity;
          return distA - distB;
        });
      }
      const chosen = typeMatches[0];
      usedTrayIds.add(chosen.globalTrayId);
      const colorMatch = coloursMatch(chosen.color, req.color);
      resultMap.set(reqIdx, {
        ...req,
        loaded: chosen,
        hasFilament: true,
        typeMatch: true,
        colorMatch,
        status: colorMatch ? 'match' : 'type_only',
        isManual: false,
      });
    }
  });

  // Pass 5: Unmatched (Type mismatch)
  filamentReqs.filaments.forEach((req, reqIdx) => {
    if (resultMap.has(reqIdx)) return;

    resultMap.set(reqIdx, {
      ...req,
      loaded: undefined,
      hasFilament: false,
      typeMatch: false,
      colorMatch: false,
      status: 'mismatch',
      isManual: false,
    });
  });

  return filamentReqs.filaments.map((_, reqIdx) => resultMap.get(reqIdx)!);
}

/**
 * Build the AMS mapping array the print command carries (non-hook version).
 */
export function buildAmsMapping(filamentComparison: FilamentComparison[]): number[] | undefined {
  if (filamentComparison.length === 0) return undefined;

  const maxSlotId = Math.max(...filamentComparison.map((f) => f.slot_id || 0));
  if (maxSlotId <= 0) return undefined;

  const mapping = new Array(maxSlotId).fill(-1);
  filamentComparison.forEach((f) => {
    if (f.slot_id && f.slot_id > 0) {
      mapping[f.slot_id - 1] = f.loaded?.globalTrayId ?? -1;
    }
  });

  return mapping;
}

/**
 * Hook to compare required filaments with loaded filaments and build AMS mapping.
 * Handles both auto-matching and manual overrides.
 */
export function useFilamentMapping(
  filamentReqs: FilamentRequirementsResponse | undefined,
  printerStatus: PrinterStatus | undefined,
  manualMappings: Record<number, number>,
  preferLowest?: boolean,
  inventoryByTrayIdOrAssignments?: Map<number, number> | SpoolAssignment[],
  slotSpoolsOrPrinterId?: SlotSpoolIdentities | number,
): UseFilamentMappingResult {
  const assignments = Array.isArray(inventoryByTrayIdOrAssignments) ? inventoryByTrayIdOrAssignments : undefined;
  const printerId = typeof slotSpoolsOrPrinterId === 'number' ? slotSpoolsOrPrinterId : undefined;
  const slotSpools = slotSpoolsOrPrinterId instanceof Map
    ? slotSpoolsOrPrinterId
    : assignmentsToSlotSpools(assignments, printerId);
  const inventoryByTrayId = inventoryByTrayIdOrAssignments instanceof Map
    ? inventoryByTrayIdOrAssignments
    : assignmentsToInventoryRemainMap(assignments, printerId);

  const loadedFilaments = useLoadedFilaments(printerStatus, slotSpools ?? assignments, printerId);

  const ftsActive = printerStatus?.fila_switch?.installed === true;

  const filamentComparison = useMemo(
    () =>
      buildFilamentComparison(
        filamentReqs,
        loadedFilaments,
        manualMappings,
        preferLowest,
        inventoryByTrayId,
        ftsActive,
      ),
    [filamentReqs, loadedFilaments, manualMappings, preferLowest, ftsActive, inventoryByTrayId],
  );

  const amsMapping = useMemo(
    () => (loadedFilaments.length === 0 ? undefined : buildAmsMapping(filamentComparison)),
    [filamentComparison, loadedFilaments.length],
  );

  const hasTypeMismatch = filamentComparison.some((f) => f.status === 'mismatch');
  const hasColorMismatch = filamentComparison.some((f) => f.status === 'type_only');

  return {
    loadedFilaments,
    filamentComparison,
    amsMapping,
    hasTypeMismatch,
    hasColorMismatch,
  };
}
