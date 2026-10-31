import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { getColorName } from '../../utils/colors';

export function extractMaterialHint(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name.trim();
  return parts.slice(1).join(' ');
}

export interface FilamentLabel {
  resolvedName: string;
  colorLabel: string;
}

export type FilamentLabelItem = FilamentLabel;

interface FilamentReqLike {
  slot_id?: number;
  type?: string;
  color?: string;
  tray_info_idx?: string;
}

export function useFilamentLabels(reqs: readonly FilamentReqLike[] | undefined): FilamentLabel[] {
  const { data: builtinFilaments } = useQuery({
    queryKey: ['builtin-filaments'],
    queryFn: () => api.getBuiltinFilaments(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: cloudFilamentIdMap } = useQuery({
    queryKey: ['filament-id-map'],
    queryFn: () => api.getFilamentIdMap(),
    staleTime: 5 * 60 * 1000,
  });

  const filamentNameByIdx = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of builtinFilaments || []) {
      if (f.filament_id) map[f.filament_id] = f.name;
    }
    for (const [fid, name] of Object.entries(cloudFilamentIdMap || {})) {
      if (fid && name) map[fid] = name;
    }
    return map;
  }, [builtinFilaments, cloudFilamentIdMap]);

  const perSlot = useMemo(() => {
    return (reqs || []).map((req) => {
      const fallbackType = req.type || 'Generic';
      const resolvedName = (req.tray_info_idx && filamentNameByIdx[req.tray_info_idx]) || fallbackType;
      return {
        resolvedName,
        materialHint: extractMaterialHint(resolvedName),
        color: req.color || '',
      };
    });
  }, [reqs, filamentNameByIdx]);

  const colorQueries = useQueries({
    queries: perSlot.map(({ color, materialHint }) => ({
      queryKey: ['color-by-material', color, materialHint],
      queryFn: () => api.getColorByMaterial(color, materialHint),
      enabled: !!color,
      staleTime: 5 * 60 * 1000,
    })),
  });

  return perSlot.map(({ resolvedName, color }, idx) => {
    const disambiguated = colorQueries[idx]?.data?.color_name ?? null;
    return {
      resolvedName,
      colorLabel: disambiguated || (color ? getColorName(color) : ''),
    };
  });
}
