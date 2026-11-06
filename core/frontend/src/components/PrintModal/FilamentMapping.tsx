import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Circle, Check, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../api/client';
import {
  assignmentsToInventoryRemainMap,
  assignmentsToSlotSpools,
  useFilamentMapping,
} from '../../hooks/useFilamentMapping';
import { getGlobalTrayId, effectivePreferLowest, FTS_INLET_SIDE } from '../../utils/amsHelpers';
import { disambiguateColorNames, getColorName, isLightColor } from '../../utils/colors';
import { useFilamentLabels } from './useFilamentLabels';
import { autoAssignRackPositions, rackOptionsForGroup } from '../../utils/nozzleRack';
import { SpoolGraphic } from './SpoolGraphic';
import type { FilamentMappingProps, RackGroupInfo } from './types';

/**
 * Filament mapping UI for comparing required filaments with loaded AMS slots.
 * Shows auto-matched and manually overridden slot assignments.
 */
export function FilamentMapping({
  printerId,
  filamentReqs,
  manualMappings,
  onManualMappingChange,
  onEstimatedCostChange,
  budgetAvailable,
  quantity = 1,
  currencySymbol,
  defaultCostPerKg,
  defaultExpanded = false,
  forceColorMatch,
  onForceColorMatchChange,
  plateLabel,
  archiveAmsMapping,
  nozzleRackChoice,
  onNozzleRackChoiceChange,
}: FilamentMappingProps & { defaultExpanded?: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number>(0);
  const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);
  const cardsContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cardsContainerRef.current && !cardsContainerRef.current.contains(event.target as Node)) {
        setOpenDropdownIdx(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // "Mapping" toggle (only shown when the archive has a saved slicer pick):
  const [usingArchiveMapping, setUsingArchiveMapping] = useState(false);
  const appliedSlotIdsRef = useRef<number[]>([]);

  useEffect(() => {
    setUsingArchiveMapping(false);
    appliedSlotIdsRef.current = [];
  }, [archiveAmsMapping, plateLabel, printerId]);

  const toggleArchiveMapping = () => {
    if (!archiveAmsMapping || !filamentReqs?.filaments) return;
    if (usingArchiveMapping) {
      const next = { ...manualMappings };
      for (const slotId of appliedSlotIdsRef.current) {
        delete next[slotId];
      }
      onManualMappingChange(next);
      appliedSlotIdsRef.current = [];
      setUsingArchiveMapping(false);
      return;
    }
    const next = { ...manualMappings };
    const appliedSlotIds: number[] = [];
    for (const req of filamentReqs.filaments) {
      const idx = req.slot_id - 1;
      if (req.slot_id > 0 && idx >= 0 && idx < archiveAmsMapping.length && archiveAmsMapping[idx] >= 0) {
        next[req.slot_id] = archiveAmsMapping[idx];
        appliedSlotIds.push(req.slot_id);
      }
    }
    onManualMappingChange(next);
    appliedSlotIdsRef.current = appliedSlotIds;
    setUsingArchiveMapping(true);
  };

  // Fetch printer status
  const { data: printerStatus } = useQuery({
    queryKey: ['printer-status', printerId],
    queryFn: () => api.getPrinterStatus(printerId),
    enabled: !!printerId,
  });

  const { data: assignments } = useQuery({
    queryKey: ['spool-assignments', printerId],
    queryFn: () => api.getAssignments(printerId),
    enabled: !!printerId,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  const inventoryByTrayId = useMemo(
    () => assignmentsToInventoryRemainMap(assignments, printerId),
    [assignments, printerId],
  );
  const slotSpools = useMemo(
    () => assignmentsToSlotSpools(assignments, printerId),
    [assignments, printerId],
  );
  const gatedPreferLowest = effectivePreferLowest(
    settings?.prefer_lowest_filament,
    printerStatus?.ams_filament_backup,
  );

  const { loadedFilaments, filamentComparison, hasTypeMismatch, hasColorMismatch } =
    useFilamentMapping(
      filamentReqs,
      printerStatus,
      manualMappings,
      gatedPreferLowest,
      inventoryByTrayId,
      slotSpools,
    );

  const filamentLabels = useFilamentLabels(filamentReqs?.filaments);

  const trayCostMap = useMemo(() => {
    const map = new Map<number, number | null>();
    for (const assignment of assignments || []) {
      const isExternal = assignment.ams_id === 255;
      const globalTrayId = getGlobalTrayId(assignment.ams_id, assignment.tray_id, isExternal);
      map.set(globalTrayId, assignment.spool?.cost_per_kg ?? null);
    }
    return map;
  }, [assignments]);

  const trayRemainingWeightMap = useMemo(() => {
    const map = new Map<number, number | null>();
    for (const assignment of assignments || []) {
      const isExternal = assignment.ams_id === 255;
      const globalTrayId = getGlobalTrayId(assignment.ams_id, assignment.tray_id, isExternal);
      const spool = assignment.spool;
      if (!spool) {
        map.set(globalTrayId, null);
        continue;
      }
      map.set(globalTrayId, Math.max(0, Math.round((spool.label_weight ?? 0) - (spool.weight_used ?? 0))));
    }
    return map;
  }, [assignments]);

  const totalCost = useMemo(() => {
    let total = 0;
    for (const item of filamentComparison) {
      const trayId = item.loaded?.globalTrayId;
      if (trayId == null) continue;
      const assignedCost = trayCostMap.get(trayId) ?? null;
      const costPerKg = assignedCost ?? defaultCostPerKg;
      if (costPerKg > 0) {
        total += (item.used_grams / 1000) * costPerKg;
      }
    }
    return total;
  }, [filamentComparison, trayCostMap, defaultCostPerKg]);

  const onEstimatedCostChangeRef = useRef(onEstimatedCostChange);
  useEffect(() => {
    onEstimatedCostChangeRef.current = onEstimatedCostChange;
  }, [onEstimatedCostChange]);
  useEffect(() => {
    onEstimatedCostChangeRef.current?.(totalCost > 0 ? totalCost : null);
  }, [totalCost]);

  const hasAnyCost = useMemo(
    () => Array.from(trayCostMap.values()).some((v) => v != null && v > 0),
    [trayCostMap]
  );
  const budgetCheckCost = totalCost * Math.max(1, quantity);
  const isBudgetInsufficient = budgetAvailable != null && budgetCheckCost > budgetAvailable;
  const hasFilamentReqs = filamentReqs?.filaments && filamentReqs.filaments.length > 0;
  const isDualNozzle = filamentReqs?.filaments?.some((f) => f.nozzle_id != null) ?? false;

  // Nozzle rack (#1784)
  const rackGroups = useMemo(() => {
    const groups = new Map<number, RackGroupInfo>();
    for (const f of filamentReqs?.filaments ?? []) {
      if (f.group_id != null && f.group) groups.set(f.group_id, f.group);
    }
    return groups;
  }, [filamentReqs]);
  const hasRack = (printerStatus?.nozzle_rack?.some((n) => n.id >= 16) ?? false)
    && [...rackGroups.values()].some((g) => g.on_rack);

  const effectiveRackChoice = useMemo(() => {
    if (!hasRack) return {};
    return (
      autoAssignRackPositions(printerStatus?.nozzle_rack, rackGroups, nozzleRackChoice ?? {})
      ?? (nozzleRackChoice ?? {})
    );
  }, [hasRack, printerStatus?.nozzle_rack, rackGroups, nozzleRackChoice]);

  const pickRackPosition = (groupId: number, position: number) => {
    if (!onNozzleRackChoiceChange) return;
    onNozzleRackChoiceChange({ ...effectiveRackChoice, [groupId]: position });
  };

  const ftsInstalled = printerStatus?.fila_switch?.installed === true;
  const amsSwitchInlet = printerStatus?.ams_switch_inlet;
  const ftsInletForAms = (amsId: number): 'A' | 'B' | null =>
    (ftsInstalled && amsSwitchInlet?.[String(amsId)]) || null;

  const sameInletWarning = useMemo(() => {
    if (!ftsInstalled) return null;
    const inlets = new Set<string>();
    for (const item of filamentComparison) {
      if (!item.loaded || item.loaded.isExternal) return null;
      const inlet = ftsInletForAms(item.loaded.amsId);
      if (!inlet) return null;
      inlets.add(inlet);
    }
    if (filamentComparison.length < 2 || inlets.size !== 1) return null;
    return [...inlets][0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ftsInstalled, amsSwitchInlet, filamentComparison]);

  // Check if the printer has an AMS (or AMS slots loaded)
  const hasAms = Boolean(
    (printerStatus?.ams_exists ?? false) ||
    (printerStatus?.ams && printerStatus.ams.length > 0) ||
    loadedFilaments.some((f) => !f.isExternal)
  );

  // Auto-expand mapping panel if the selected printer has an AMS
  const autoExpandedForPrinterRef = useRef<number | null>(null);
  useEffect(() => {
    if (!printerId || !printerStatus) return;
    if (autoExpandedForPrinterRef.current !== printerId) {
      autoExpandedForPrinterRef.current = printerId;
      if (!plateLabel && hasAms) {
        setIsExpanded(true);
      }
    }
  }, [printerId, printerStatus, hasAms, plateLabel]);

  // Bambu Studio AMS Units & Slot grid data
  const amsUnitsData = useMemo(() => {
    const amsList: Array<{
      amsId: number;
      amsName: string;
      isHt: boolean;
      slots: Array<{
        trayLabel: string;
        trayIdx: number;
        isLoaded: boolean;
        color?: string;
        type?: string;
        globalTrayId?: number;
        fullLabel: string;
      }>;
    }> = [];

    const amsUnits = printerStatus?.ams && printerStatus.ams.length > 0
      ? printerStatus.ams
      : Array.from(new Set(loadedFilaments.filter(f => !f.isExternal).map(f => f.amsId)))
          .map(id => ({ id, tray: [] as unknown[] }));

    amsUnits.forEach((unit, amsIdx) => {
      const amsId = unit.id;
      const isSnapmakerU1 = (unit as { module_type?: string }).module_type === 'snapmaker_u1';
      const amsLetter = String.fromCharCode(65 + amsId);
      const isHt = unit.tray?.length === 1;
      const slotCount = isHt ? 1 : 4;
      const slots = [];

      for (let trayIdx = 0; trayIdx < slotCount; trayIdx++) {
        const trayLabel = isSnapmakerU1 ? `E${trayIdx + 1}` : `${amsLetter}${trayIdx + 1}`;
        const loaded = loadedFilaments.find(f => !f.isExternal && f.amsId === amsId && f.trayId === trayIdx);
        if (loaded) {
          const remainingWeight = trayRemainingWeightMap.get(loaded.globalTrayId);
          const remainingLabel = remainingWeight != null ? ` - ${remainingWeight}g` : '';
          const ftsInlet = ftsInletForAms(loaded.amsId);
          const ftsBadge = ftsInlet == null ? '' : ` [${FTS_INLET_SIDE[ftsInlet]}]`;

          slots.push({
            trayLabel: loaded.label,
            trayIdx,
            isLoaded: true,
            color: loaded.color,
            type: (loaded.type || '').replace(/^Generic\s+/i, ''),
            globalTrayId: loaded.globalTrayId,
            fullLabel: `${loaded.label}: ${loaded.spoolName || loaded.traySubBrands || loaded.type} (${loaded.colorName})${remainingLabel}${ftsBadge}`,
          });
        } else {
          slots.push({
            trayLabel,
            trayIdx,
            isLoaded: false,
            type: '-',
            fullLabel: `${trayLabel}: Empty`,
          });
        }
      }

      amsList.push({
        amsId,
        amsName: isSnapmakerU1 ? ((unit as { name?: string }).name || 'Extruders') : (isHt ? `AMS-HT(${amsIdx + 1})` : `AMS(${amsIdx + 1})`),
        isHt,
        slots,
      });
    });

    return amsList;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printerStatus?.ams, loadedFilaments, trayRemainingWeightMap, ftsInstalled, amsSwitchInlet]);

  const externalSlotsData = useMemo(() => {
    if (hasAms) return null;

    const extFilaments = loadedFilaments.filter(f => f.isExternal);
    const vtTrays = printerStatus?.vt_tray ?? [];
    if (extFilaments.length === 0 && vtTrays.length === 0) return null;

    const count = Math.max(extFilaments.length, vtTrays.length, 1);
    const slots = [];

    for (let i = 0; i < count; i++) {
      const loaded = extFilaments[i] || (vtTrays[i] ? loadedFilaments.find(f => f.trayId === vtTrays[i].id) : undefined);
      const trayLabel = count > 1 ? `Ext ${i + 1}` : 'Ext';

      if (loaded) {
        const remainingWeight = trayRemainingWeightMap.get(loaded.globalTrayId);
        const remainingLabel = remainingWeight != null ? ` - ${remainingWeight}g` : '';
        slots.push({
          trayLabel: loaded.label || trayLabel,
          trayIdx: i,
          isLoaded: true,
          color: loaded.color,
          type: (loaded.type || '').replace(/^Generic\s+/i, ''),
          globalTrayId: loaded.globalTrayId,
          fullLabel: `${loaded.label || trayLabel}: ${loaded.spoolName || loaded.traySubBrands || loaded.type} (${loaded.colorName})${remainingLabel}`,
        });
      } else {
        slots.push({
          trayLabel,
          trayIdx: i,
          isLoaded: false,
          type: '-',
          fullLabel: `${trayLabel}: Empty`,
        });
      }
    }

    return {
      groupName: 'Ext',
      slots,
    };
  }, [hasAms, loadedFilaments, printerStatus?.vt_tray, trayRemainingWeightMap]);

  if (!hasFilamentReqs) {
    return null;
  }

  if (!printerStatus) {
    return null;
  }

  const isMultiColor = (filamentReqs?.filaments?.length ?? 0) > 1;
  const hasUnassignedSlots = isMultiColor && filamentComparison.some((f) => !f.loaded);

  const statusColor = hasUnassignedSlots
    ? '#ef4444' // red
    : hasTypeMismatch
    ? '#f97316' // orange
    : hasColorMismatch
    ? '#facc15' // yellow
    : '#00ae42'; // green

  const handleSlotChange = (slotId: number, value: string) => {
    if (slotId > 0) {
      if (value === '') {
        const next = { ...manualMappings };
        delete next[slotId];
        onManualMappingChange(next);
      } else {
        onManualMappingChange({
          ...manualMappings,
          [slotId]: parseInt(value, 10),
        });
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await api.refreshPrinterStatus(printerId);
      await new Promise((r) => setTimeout(r, 500));
      await queryClient.refetchQueries({ queryKey: ['printer-status', printerId] });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-bambu-gray hover:text-white transition-colors w-full"
      >
        <Circle className="w-4 h-4" fill={statusColor} stroke="none" />
        <span>{plateLabel ? `${t('printModal.filamentMapping')} — ${plateLabel}` : t('printModal.filamentMapping')}</span>
        {hasUnassignedSlots ? (
          <span className="text-xs text-red-500 dark:text-red-400">({t('printModal.statusSlotUnassigned', 'Slots unassigned')})</span>
        ) : hasTypeMismatch ? (
          <span className="text-xs text-orange-700 dark:text-orange-400">({t('printModal.statusTypeNotFound')})</span>
        ) : hasColorMismatch ? (
          <span className="text-xs text-yellow-700 dark:text-yellow-400">({t('printModal.statusColorMismatch')})</span>
        ) : (
          <span className="text-xs text-bambu-green">({t('printModal.statusReady')})</span>
        )}
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 ml-auto" />
        ) : (
          <ChevronDown className="w-4 h-4 ml-auto" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 bg-bambu-dark rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-bambu-gray">{t('printModal.clickToChangeSlot')}</span>
            <div className="flex items-center gap-1.5">
              {archiveAmsMapping && (
                <button
                  type="button"
                  onClick={toggleArchiveMapping}
                  title={t('printModal.useArchiveMappingTooltip')}
                  className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded border transition-colors ${
                    usingArchiveMapping
                      ? 'border-bambu-green bg-bambu-green/10 text-bambu-green'
                      : 'border-bambu-gray/30 hover:border-bambu-gray hover:bg-bambu-dark-tertiary text-bambu-gray hover:text-white'
                  }`}
                >
                  <Check className="w-3 h-3" />
                  <span>{t('printModal.useArchiveMapping')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleRefresh}
                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-bambu-gray/30 hover:border-bambu-gray hover:bg-bambu-dark-tertiary transition-colors text-bambu-gray hover:text-white"
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{t('printModal.reRead')}</span>
              </button>
            </div>
          </div>
          {sameInletWarning && (
            <div className="flex items-start gap-1.5 rounded border border-yellow-500/40 bg-yellow-500/10 px-2 py-1.5 text-xs text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{t('printModal.ftsSameInletHint', { inlet: sameInletWarning })}</span>
            </div>
          )}

          {/* Bambu Studio Visual Filament Spool Cards */}
          <div
            ref={cardsContainerRef}
            className="flex flex-wrap gap-2 sm:gap-2.5 p-2.5 bg-bambu-dark-secondary/40 rounded-lg border border-bambu-dark-tertiary/60 relative"
          >
            {filamentComparison.map((item, idx) => {
              const slotId = item.slot_id ?? 0;
              const canForceMatch = slotId > 0 && onForceColorMatchChange != null;
              const { resolvedName, colorLabel } = filamentLabels[idx] ?? {
                resolvedName: item.type,
                colorLabel: getColorName(item.color),
              };
              const [requiredColorLabel, loadedColorLabel] = disambiguateColorNames(
                { name: colorLabel, hex: item.color },
                { name: item.loaded?.colorName, hex: item.loaded?.color },
              );
              const isSelected = selectedCardIndex === idx;
              const isDropdownOpen = openDropdownIdx === idx;
              const loadedLabel = item.loaded?.label ?? '--';

              const displayType = (item.type || resolvedName || '').replace(/^Generic\s+/i, '');

              return (
                <div
                  key={idx}
                  className={`relative flex flex-col rounded-lg overflow-visible text-left transition-all duration-150 w-24 shrink-0 border ${
                    isSelected || isDropdownOpen
                      ? 'border-2 border-bambu-green ring-1 ring-bambu-green/40 shadow-md shadow-bambu-green/20'
                      : item.status === 'type_only'
                      ? 'border border-yellow-500/70 hover:border-yellow-400'
                      : item.status === 'mismatch'
                      ? 'border border-orange-500/70 hover:border-orange-400'
                      : 'border border-bambu-gray/40 hover:border-bambu-gray'
                  }`}
                >
                  {/* Status mismatch alert badge */}
                  {item.status === 'type_only' ? (
                    <span
                      title={
                        requiredColorLabel && loadedColorLabel
                          ? t('printModal.sameTypeDifferentColorDetail', {
                              required: requiredColorLabel,
                              loaded: loadedColorLabel,
                            })
                          : t('printModal.sameTypeDifferentColor')
                      }
                      className="absolute -top-1.5 -right-1.5 z-20 bg-yellow-500 text-black rounded-full p-0.5 shadow"
                    >
                      <AlertTriangle className="w-3 h-3" />
                    </span>
                  ) : item.status === 'mismatch' ? (
                    <span
                      title={t('printModal.filamentTypeNotLoaded')}
                      className="absolute -top-1.5 -right-1.5 z-20 bg-orange-500 text-white rounded-full p-0.5 shadow"
                    >
                      <AlertTriangle className="w-3 h-3" />
                    </span>
                  ) : null}

                  {/* Top Header: Sliced Filament Color & Material Type + Force Color Match Checkbox */}
                  <div
                    onClick={() => {
                      setSelectedCardIndex(idx);
                      setOpenDropdownIdx(isDropdownOpen ? null : idx);
                    }}
                    className="h-7 px-1.5 flex items-center justify-between gap-1 font-bold text-xs uppercase tracking-wider w-full rounded-t-[6px] cursor-pointer select-none"
                    style={{
                      backgroundColor: item.color,
                      color: isLightColor(item.color) ? '#111827' : '#ffffff',
                    }}
                    title={t('printModal.requiredTooltip', { name: resolvedName, color: requiredColorLabel })}
                  >
                    {/* Dual Nozzle / Nozzle Rack Badge */}
                    {hasRack && item.group_id != null && item.group ? (
                      item.group.on_rack ? (
                        <select
                          value={effectiveRackChoice[item.group_id] ?? ''}
                          onChange={(e) => pickRackPosition(item.group_id!, Number(e.target.value))}
                          disabled={!onNozzleRackChoiceChange}
                          title={t('printModal.rackPositionTooltip')}
                          aria-label={t('printModal.rackPosition')}
                          className="shrink-0 bg-black/40 text-white text-[9px] font-bold rounded px-0.5 py-0.5 border border-white/20 focus:border-bambu-green outline-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {rackOptionsForGroup(printerStatus?.nozzle_rack, item.group, t).map((option) => (
                            <option
                              key={option.position}
                              value={option.position}
                              disabled={!option.eligible}
                              title={option.reason}
                              className="bg-bambu-dark text-white"
                            >
                              R{option.position}
                              {option.diameter ? ` · ${option.diameter}` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded text-[8px] font-bold leading-none bg-black/30 text-white shrink-0"
                          title={t('printModal.leftNozzleTooltip')}
                        >
                          {t('printModal.leftNozzle')}
                        </span>
                      )
                    ) : isDualNozzle && item.nozzle_id != null ? (
                      <span
                        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded text-[8px] font-bold leading-none bg-black/30 text-white shrink-0"
                        title={item.nozzle_id === 1 ? t('printModal.leftNozzleTooltip') : t('printModal.rightNozzleTooltip')}
                      >
                        {item.nozzle_id === 1 ? t('printModal.leftNozzle') : t('printModal.rightNozzle')}
                      </span>
                    ) : null}

                    <span className="shrink-0 px-1 py-0.5 rounded text-[9px] font-black bg-black/30 text-white/90 leading-none">
                      T{item.slot_id}
                    </span>

                    <span className="truncate min-w-0 flex-1 text-center" title={resolvedName}>
                      {displayType}
                    </span>

                    {/* Force Color Match checkbox without text on top bar */}
                    {canForceMatch && (
                      <label
                        title={t('printModal.forceColorMatch')}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 flex items-center justify-center cursor-pointer p-0.5 rounded hover:bg-black/20 transition-colors"
                      >
                        <span className="sr-only">{t('printModal.forceColorMatch')}</span>
                        <input
                          type="checkbox"
                          title={t('printModal.forceColorMatch')}
                          checked={forceColorMatch?.[slotId] ?? false}
                          onChange={(e) => onForceColorMatchChange(slotId, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-bambu-green w-3.5 h-3.5 rounded cursor-pointer"
                        />
                      </label>
                    )}
                  </div>

                  {/* Bottom: Loaded Physical Spool Graphic & Slot Selector Trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCardIndex(idx);
                      setOpenDropdownIdx(isDropdownOpen ? null : idx);
                    }}
                    className="bg-[#222429] hover:bg-[#2a2d33] px-1.5 py-1 flex items-center justify-between gap-1 w-full h-9 rounded-b-[6px] transition-colors cursor-pointer focus:outline-none"
                    title={`${resolvedName} (${item.used_grams}g) → ${item.loaded ? `${item.loaded.label}: ${item.loaded.spoolName || item.loaded.type}` : t('printModal.selectSlot')}`}
                  >
                    <SpoolGraphic
                      color={item.loaded?.color}
                      isEmpty={!item.loaded}
                      className="w-7 h-5 shrink-0"
                    />
                    <div className="flex items-center gap-0.5 text-xs sm:text-sm font-bold text-white min-w-0">
                      <span className="truncate">{loadedLabel}</span>
                      <ChevronDown className={`w-3 h-3 text-bambu-gray shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Accessible select for forms & screen readers */}
                  <select
                    value={item.loaded?.globalTrayId ?? ''}
                    onChange={(e) => handleSlotChange(slotId, e.target.value)}
                    onClick={() => setOpenDropdownIdx(isDropdownOpen ? null : idx)}
                    aria-label={`Slot mapping for ${resolvedName}`}
                    className="sr-only"
                    tabIndex={-1}
                  >
                    <option value="">-- {t('printModal.selectSlot')} --</option>
                    {loadedFilaments.map((f) => {
                      const remainingWeight = trayRemainingWeightMap.get(f.globalTrayId);
                      const remainingLabel = remainingWeight != null
                        ? t('printModal.slotRemainingShort', { grams: remainingWeight, defaultValue: ` - ${remainingWeight}g left` })
                        : '';
                      const ftsInlet = ftsInletForAms(f.amsId);
                      const ftsBadge = ftsInlet == null ? '' : ` [${FTS_INLET_SIDE[ftsInlet]}]`;
                      return (
                        <option key={f.globalTrayId} value={f.globalTrayId}>
                          {f.label}: {f.spoolName || f.traySubBrands || f.type} ({f.colorName}){remainingLabel}{ftsBadge}
                        </option>
                      );
                    })}
                  </select>

                  {/* Bambu Studio Slot Selection Popup */}
                  {isDropdownOpen && (
                    <div
                      role="listbox"
                      className={`absolute top-full ${
                        idx > 1 ? 'right-0' : 'left-0'
                      } mt-1.5 z-50 w-72 sm:w-80 bg-[#1e2024] border border-[#333740] rounded-lg shadow-2xl p-2.5 text-white space-y-2`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Popup Header */}
                      <div className="flex items-center justify-between border-b border-[#2d3036] pb-1.5 text-xs font-bold text-white/90">
                        <span>{t('printModal.selectSlot')}</span>
                        <span className="text-[10px] text-bambu-gray font-normal truncate max-w-[150px]" title={resolvedName}>
                          {resolvedName} ({item.used_grams}g)
                        </span>
                      </div>

                      {/* AMS Unit Groups */}
                      {amsUnitsData.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold text-bambu-gray uppercase tracking-wider">
                            {t('printModal.ams', 'AMS')}
                          </div>

                          {amsUnitsData.map((unit) => (
                            <div
                              key={unit.amsId}
                              className="bg-[#141619] rounded-md border border-[#2a2d33] overflow-hidden shadow-inner"
                            >
                              <div className="grid grid-cols-4 gap-1.5 p-1.5">
                                {unit.slots.map((slot) => {
                                  const isCurrent = slot.isLoaded && item.loaded?.globalTrayId === slot.globalTrayId;
                                  const isLight = slot.color ? isLightColor(slot.color) : false;

                                  if (slot.isLoaded) {
                                    return (
                                      <button
                                        key={slot.trayLabel}
                                        type="button"
                                        onClick={() => {
                                          handleSlotChange(slotId, String(slot.globalTrayId));
                                          setOpenDropdownIdx(null);
                                        }}
                                        title={slot.fullLabel}
                                        className={`relative flex flex-col items-center justify-center h-14 sm:h-16 rounded transition-all cursor-pointer select-none font-bold ${
                                          isCurrent
                                            ? 'ring-2 ring-white ring-offset-1 ring-offset-[#141619] shadow-lg scale-[1.02]'
                                            : 'hover:brightness-110 active:scale-95'
                                        }`}
                                        style={{
                                          backgroundColor: slot.color,
                                          color: isLight ? '#111827' : '#ffffff',
                                        }}
                                      >
                                        {/* Top Color Stripe */}
                                        <div
                                          className="w-full h-1 absolute top-0 left-0 rounded-t opacity-40 bg-white"
                                        />

                                        {/* Checkmark icon on selected slot */}
                                        {isCurrent && (
                                          <span className="absolute top-0.5 right-0.5 leading-none drop-shadow">
                                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                          </span>
                                        )}

                                        <span className="text-xs sm:text-sm font-extrabold leading-tight">
                                          {slot.trayLabel}
                                        </span>
                                        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide leading-tight opacity-90 truncate max-w-[90%]">
                                          {slot.type}
                                        </span>
                                        <span className="sr-only">{slot.fullLabel}</span>
                                      </button>
                                    );
                                  }

                                  // Empty / Unloaded Slot
                                  return (
                                    <div
                                      key={slot.trayLabel}
                                      title={slot.fullLabel}
                                      className="relative flex flex-col items-center justify-center h-14 sm:h-16 rounded bg-[#222429] text-[#6b7280] font-bold select-none cursor-not-allowed opacity-50"
                                    >
                                      <span className="text-xs sm:text-sm font-extrabold leading-tight">
                                        {slot.trayLabel}
                                      </span>
                                      <span className="text-[10px] sm:text-[11px] font-bold leading-tight">
                                        -
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="bg-[#2d3036] text-[#9ca3af] text-[10px] sm:text-[11px] font-bold text-center py-0.5 tracking-wider uppercase">
                                {unit.amsName}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* External Spool Group */}
                      {externalSlotsData && (
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[10px] font-bold text-bambu-gray uppercase tracking-wider">
                            {externalSlotsData.groupName}
                          </div>
                          <div className="bg-[#141619] rounded-md border border-[#2a2d33] overflow-hidden shadow-inner">
                            <div className="grid grid-cols-4 gap-1.5 p-1.5">
                              {externalSlotsData.slots.map((slot) => {
                                const isCurrent = slot.isLoaded && item.loaded?.globalTrayId === slot.globalTrayId;
                                const isLight = slot.color ? isLightColor(slot.color) : false;

                                if (slot.isLoaded) {
                                  return (
                                    <button
                                      key={slot.trayLabel}
                                      type="button"
                                      onClick={() => {
                                        handleSlotChange(slotId, String(slot.globalTrayId));
                                        setOpenDropdownIdx(null);
                                      }}
                                      title={slot.fullLabel}
                                      className={`relative flex flex-col items-center justify-center h-14 sm:h-16 rounded transition-all cursor-pointer select-none font-bold ${
                                        isCurrent
                                          ? 'ring-2 ring-white ring-offset-1 ring-offset-[#141619] shadow-lg scale-[1.02]'
                                          : 'hover:brightness-110 active:scale-95'
                                      }`}
                                      style={{
                                        backgroundColor: slot.color,
                                        color: isLight ? '#111827' : '#ffffff',
                                      }}
                                    >
                                      {isCurrent && (
                                        <span className="absolute top-0.5 right-0.5 leading-none drop-shadow">
                                          <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                        </span>
                                      )}
                                      <span className="text-xs sm:text-sm font-extrabold leading-tight">
                                        {slot.trayLabel}
                                      </span>
                                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide leading-tight opacity-90 truncate max-w-[90%]">
                                        {slot.type}
                                      </span>
                                    </button>
                                  );
                                }

                                return (
                                  <div
                                    key={slot.trayLabel}
                                    title={slot.fullLabel}
                                    className="relative flex flex-col items-center justify-center h-14 sm:h-16 rounded bg-[#222429] text-[#6b7280] font-bold select-none cursor-not-allowed opacity-50"
                                  >
                                    <span className="text-xs sm:text-sm font-extrabold leading-tight">
                                      {slot.trayLabel}
                                    </span>
                                    <span className="text-[10px] sm:text-[11px] font-bold leading-tight">
                                      -
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="bg-[#2d3036] text-[#9ca3af] text-[10px] sm:text-[11px] font-bold text-center py-0.5 tracking-wider uppercase">
                              {externalSlotsData.groupName}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Clear / Unselect Slot Button */}
                      <div className="pt-1.5 border-t border-[#2d3036] flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            handleSlotChange(slotId, '');
                            setOpenDropdownIdx(null);
                          }}
                          className="text-[11px] text-bambu-gray hover:text-white px-2 py-0.5 rounded hover:bg-[#2a2d33] transition-colors"
                        >
                          -- {t('printModal.selectSlot')} --
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-xs text-bambu-gray">
            {t('printModal.totalCost')}{' '}
            <span className="text-white">
              {totalCost > 0 || hasAnyCost ? `${currencySymbol}${totalCost.toFixed(2)}` : 'N/A'}
            </span>
            {quantity > 1 && totalCost > 0 && (
              <span className="ml-2">
                {t('printModal.totalCostForQuantity', 'total: {{cost}}', {
                  cost: `${currencySymbol}${budgetCheckCost.toFixed(2)}`,
                })}
              </span>
            )}
          </div>
          {isBudgetInsufficient && (
            <p className="text-xs text-red-400 mt-2">
              {t('printModal.insufficientBudget', 'Insufficient budget for this cost center.')}
            </p>
          )}
          {hasUnassignedSlots ? (
            <p className="text-xs text-red-500 dark:text-red-400 mt-2">
              {t('printModal.unassignedMultiColorSlotsWarning', 'All required colors must be assigned to a slot before printing.')}
            </p>
          ) : hasTypeMismatch ? (
            <p className="text-xs text-orange-700 dark:text-orange-400 mt-2">
              {t('printModal.requiredTypeNotInPrinter')}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
