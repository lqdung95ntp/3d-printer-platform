import { Layers, Check, AlertTriangle, Square, CheckSquare, Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PlateSelectorProps } from './types';
import { formatDuration } from '../../utils/date';
import { withStreamToken } from '../../api/client';
import { getBedTypeInfo } from '../../utils/bedType';
import { NumberInput } from '../NumberInput';

/**
 * Plate selection grid for multi-plate 3MF files.
 * Shows thumbnails, names, objects, and print times for each plate.
 * In multi-select mode, plates have checkboxes for selecting a subset.
 * In single-select mode, only one plate can be selected at a time.
 */
export function PlateSelector({
  plates,
  isMultiPlate,
  selectedPlates,
  onToggle,
  onSelectAll,
  onDeselectAll,
  multiSelect,
  quantities,
  onQuantityChange,
}: PlateSelectorProps) {
  const { t } = useTranslation();

  // Only show for multi-plate files with multiple plates
  if (!isMultiPlate || plates.length <= 1) {
    return null;
  }

  const allSelected = selectedPlates.size === plates.length;
  const showQuantities = !!quantities && !!onQuantityChange;
  const totalRuns = showQuantities
    ? plates.reduce((sum, p) => (selectedPlates.has(p.index) ? sum + (quantities[p.index] ?? 1) : sum), 0)
    : 0;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="w-4 h-4 text-bambu-gray" />
        <span className="text-sm text-bambu-gray">Select Plate{multiSelect ? 's' : ''} to Print</span>
        {selectedPlates.size === 0 && (
          <span className="text-xs text-orange-700 dark:text-orange-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Selection required
          </span>
        )}
        {multiSelect && onSelectAll && onDeselectAll && (
          <button
            type="button"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className={`ml-auto text-xs px-2 py-0.5 rounded-full border transition-colors ${
              allSelected
                ? 'border-bambu-green bg-bambu-green/10 text-bambu-green'
                : 'border-bambu-dark-tertiary text-bambu-gray hover:border-bambu-gray'
            }`}
          >
            {allSelected
              ? t('queue.deselectAll')
              : t('queue.selectAllPlates', { count: plates.length })}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {plates.map((plate) => {
          const isSelected = selectedPlates.has(plate.index);
          return (
            <div
              key={plate.index}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                isSelected
                  ? 'border-bambu-green bg-bambu-green/10'
                  : 'border-bambu-dark-tertiary bg-bambu-dark hover:border-bambu-gray'
              }`}
            >
              <button
                type="button"
                onClick={() => onToggle(plate.index)}
                className="flex items-center gap-2 text-left min-w-0 flex-1"
              >
                {multiSelect && (
                  isSelected
                    ? <CheckSquare className="w-4 h-4 text-bambu-green flex-shrink-0" />
                    : <Square className="w-4 h-4 text-bambu-gray flex-shrink-0" />
                )}
                {plate.has_thumbnail && plate.thumbnail_url != null ? (
                  <img
                    src={withStreamToken(plate.thumbnail_url)}
                    alt={`Plate ${plate.index}`}
                    className="w-10 h-10 rounded object-cover bg-bambu-dark-tertiary"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-bambu-dark-tertiary flex items-center justify-center">
                    <Layers className="w-5 h-5 text-bambu-gray" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium truncate">
                    {plate.name || `Plate ${plate.index}`}
                  </p>
                  <p className="text-xs text-bambu-gray truncate">
                    {plate.objects.length > 0
                      ? plate.objects.slice(0, 3).join(', ') +
                        (plate.objects.length > 3 ? '...' : '')
                      : `${plate.filaments.length} filament${plate.filaments.length !== 1 ? 's' : ''}`}
                    {plate.print_time_seconds != null ? ` • ${formatDuration(plate.print_time_seconds)}` : ''}
                  </p>
                  {(() => {
                    const bed = getBedTypeInfo(plate.bed_type);
                    if (!bed) return null;
                    return (
                      <p className="text-xs text-bambu-gray flex items-center gap-1 mt-0.5 truncate" title={bed.label}>
                        <img src={bed.icon} alt="" className="w-3.5 h-3.5 object-contain flex-shrink-0" />
                        <span className="truncate">{bed.label}</span>
                      </p>
                    );
                  })()}
                </div>
                {!multiSelect && isSelected && (
                  <Check className="w-4 h-4 text-bambu-green flex-shrink-0" />
                )}
              </button>
              {showQuantities && isSelected && (
                <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs text-bambu-gray mr-1" aria-hidden="true">×</span>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = quantities[plate.index] ?? 1;
                      onQuantityChange(plate.index, Math.max(1, cur - 1));
                    }}
                    disabled={(quantities[plate.index] ?? 1) <= 1}
                    aria-label="Decrease plate quantity"
                    className="p-1 bg-bambu-dark border border-bambu-dark-tertiary rounded-l text-bambu-gray hover:text-white hover:bg-bambu-dark-tertiary disabled:opacity-40 disabled:hover:bg-bambu-dark disabled:hover:text-bambu-gray transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <NumberInput
                    min={1}
                    max={999}
                    value={quantities[plate.index] ?? 1}
                    fallback={1}
                    aria-label={t('queue.plateQuantityLabel', {
                      plate: plate.name || t('queue.plateNumber', { index: plate.index }),
                    })}
                    onChange={(v) => onQuantityChange(plate.index, v)}
                    className="w-10 px-1 py-1 text-sm bg-bambu-dark border-y border-bambu-dark-tertiary text-white text-center focus:outline-none focus:ring-1 focus:ring-bambu-green"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const cur = quantities[plate.index] ?? 1;
                      onQuantityChange(plate.index, Math.min(999, cur + 1));
                    }}
                    disabled={(quantities[plate.index] ?? 1) >= 999}
                    aria-label="Increase plate quantity"
                    className="p-1 bg-bambu-dark border border-bambu-dark-tertiary rounded-r text-bambu-gray hover:text-white hover:bg-bambu-dark-tertiary disabled:opacity-40 disabled:hover:bg-bambu-dark disabled:hover:text-bambu-gray transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {showQuantities && totalRuns > selectedPlates.size && (
        <p className="text-xs text-bambu-gray mt-2">
          {t('queue.plateQuantityTotal', { count: totalRuns })}
        </p>
      )}
    </div>
  );
}
