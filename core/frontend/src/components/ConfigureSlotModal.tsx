import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Settings2, RotateCcw, Check } from 'lucide-react';
import { api } from '../api/client';
import { Button } from './Button';
import { useToast } from '../contexts/ToastContext';

export interface NonAmsSlotInfo {
  amsId: number;
  trayId: number;
  trayCount: number;
  trayType?: string;
  trayColor?: string;
  traySubBrands?: string;
  slotLabel?: string;
}

interface ConfigureSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  printerId: number;
  slotInfo: NonAmsSlotInfo;
  onSuccess?: () => void;
}

const COMMON_MATERIALS = [
  'PLA',
  'PETG',
  'ABS',
  'ASA',
  'TPU',
  'PC',
  'PA-CF',
  'PLA-CF',
  'PETG-CF',
  'PVA',
];

const PRESET_COLORS = [
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#1A1A1A' },
  { name: 'Red', hex: '#E72F1D' },
  { name: 'Blue', hex: '#1E88E5' },
  { name: 'Green', hex: '#43A047' },
  { name: 'Yellow', hex: '#FDD835' },
  { name: 'Orange', hex: '#FB8C00' },
  { name: 'Purple', hex: '#8E24AA' },
  { name: 'Cyan', hex: '#00ACC1' },
  { name: 'Gray', hex: '#757575' },
  { name: 'Brown', hex: '#6D4C41' },
  { name: 'Silver', hex: '#CFD8DC' },
];

export function ConfigureSlotModal({
  isOpen,
  onClose,
  printerId,
  slotInfo,
  onSuccess,
}: ConfigureSlotModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [selectedMaterial, setSelectedMaterial] = useState<string>('PLA');
  const [subBrands, setSubBrands] = useState<string>('');
  const [customColor, setCustomColor] = useState<string>('#FFFFFF');

  // Initialize form when opening
  useEffect(() => {
    if (isOpen && slotInfo) {
      setSelectedMaterial(slotInfo.trayType || 'PLA');
      setSubBrands(slotInfo.traySubBrands || '');
      
      let initColor = slotInfo.trayColor || '#FFFFFF';
      if (!initColor.startsWith('#')) {
        initColor = `#${initColor.slice(0, 6)}`;
      }
      setCustomColor(initColor);
    }
  }, [isOpen, slotInfo]);

  // Configure Slot mutation
  const configureMutation = useMutation({
    mutationFn: async () => {
      // Normalize color to RRGGBBAA or #RRGGBB
      let hexColor = customColor.replace(/^#/, '');
      if (hexColor.length === 6) {
        hexColor = `${hexColor}FF`;
      }

      return api.configureAmsSlot(printerId, slotInfo.amsId, slotInfo.trayId, {
        tray_info_idx: selectedMaterial,
        tray_type: selectedMaterial,
        tray_sub_brands: subBrands.trim() || selectedMaterial,
        tray_color: hexColor,
        nozzle_temp_min: 190,
        nozzle_temp_max: 240,
        cali_idx: -1,
        nozzle_diameter: '0.4',
      });
    },
    onSuccess: () => {
      showToast(t('common.success', 'Configuration saved'), 'success');
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      showToast(err?.message || t('common.error', 'Failed to save configuration'), 'error');
    },
  });

  // Reset Slot mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      return api.resetAmsSlot(printerId, slotInfo.amsId, slotInfo.trayId);
    },
    onSuccess: () => {
      showToast(t('common.success', 'Slot reset'), 'success');
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      showToast(err?.message || t('common.error', 'Failed to reset slot'), 'error');
    },
  });

  if (!isOpen) return null;

  const isSaving = configureMutation.isPending || resetMutation.isPending;
  const slotDisplay = slotInfo.slotLabel || `Slot ${slotInfo.trayId + 1}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-bambu-dark-secondary rounded-xl shadow-2xl border border-bambu-dark-tertiary overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bambu-dark-tertiary">
          <div className="flex items-center gap-2.5">
            <Settings2 className="w-5 h-5 text-bambu-green" />
            <h2 className="text-base font-semibold text-white">
              {t('ams.configureSlot', 'Configure Slot')}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1 text-bambu-gray hover:text-white rounded-lg hover:bg-bambu-dark-tertiary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Slot preview banner */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-bambu-dark border border-bambu-dark-tertiary">
            <div className="space-y-0.5">
              <span className="text-xs text-bambu-gray font-medium">
                {t('configureAmsSlot.configuringSlot', 'Configuring slot')}
              </span>
              <div className="text-sm font-semibold text-white">{slotDisplay}</div>
            </div>
            {/* Live swatch circle */}
            <div
              className="w-8 h-8 rounded-full border-2 border-white/20 shadow-inner flex items-center justify-center font-bold text-xs"
              style={{
                backgroundColor: customColor,
                color: ['#FFFFFF', '#CFD8DC', '#FDD835'].includes(customColor.toUpperCase())
                  ? '#000000'
                  : '#FFFFFF',
              }}
            >
              {slotInfo.trayId + 1}
            </div>
          </div>

          {/* Filament Material */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-bambu-gray">
              {t('spool.material', 'Material')} <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {COMMON_MATERIALS.map((mat) => {
                const active = selectedMaterial.toUpperCase() === mat.toUpperCase();
                return (
                  <button
                    key={mat}
                    type="button"
                    onClick={() => setSelectedMaterial(mat)}
                    className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all ${
                      active
                        ? 'bg-bambu-green/20 border-bambu-green text-bambu-green font-semibold'
                        : 'bg-bambu-dark border-bambu-dark-tertiary text-bambu-gray hover:text-white hover:border-gray-500'
                    }`}
                  >
                    {mat}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              placeholder={t('spool.customMaterial', 'Custom Material (e.g. TPU-95A)')}
              className="w-full mt-1.5 px-3 py-2 text-sm bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white placeholder-bambu-gray/50 focus:outline-none focus:border-bambu-green"
            />
          </div>

          {/* Brand / Sub-brand */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-bambu-gray">
              {t('spool.brand', 'Brand / Variant (optional)')}
            </label>
            <input
              type="text"
              value={subBrands}
              onChange={(e) => setSubBrands(e.target.value)}
              placeholder="e.g. SnapSpeed, eSUN PLA+, PolyLite..."
              className="w-full px-3 py-2 text-sm bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white placeholder-bambu-gray/50 focus:outline-none focus:border-bambu-green"
            />
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-bambu-gray">
              {t('spool.color', 'Color')} <span className="text-red-400">*</span>
            </label>

            {/* Presets Grid */}
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((preset) => {
                const isSelected = customColor.toUpperCase() === preset.hex.toUpperCase();
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setCustomColor(preset.hex)}
                    title={preset.name}
                    className={`relative h-8 rounded-lg border flex items-center justify-center transition-all ${
                      isSelected
                        ? 'ring-2 ring-bambu-green border-transparent scale-105'
                        : 'border-white/10 hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                  >
                    {isSelected && (
                      <Check
                        className={`w-4 h-4 ${
                          ['#FFFFFF', '#CFD8DC', '#FDD835'].includes(preset.hex)
                            ? 'text-black'
                            : 'text-white'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Hex input & native picker */}
            <div className="flex items-center gap-2 mt-2">
              <div
                className="w-9 h-9 rounded-lg border border-bambu-dark-tertiary overflow-hidden flex-shrink-0 cursor-pointer relative"
                style={{ backgroundColor: customColor }}
              >
                <input
                  type="color"
                  value={customColor.startsWith('#') ? customColor : `#${customColor}`}
                  onChange={(e) => setCustomColor(e.target.value.toUpperCase())}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value.toUpperCase())}
                placeholder="#FFFFFF"
                className="flex-1 px-3 py-2 text-sm bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white placeholder-bambu-gray/50 focus:outline-none focus:border-bambu-green font-mono uppercase"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-bambu-dark-tertiary bg-bambu-dark/50">
          <Button
            type="button"
            variant="ghost"
            onClick={() => resetMutation.mutate()}
            disabled={isSaving}
            className="text-bambu-gray hover:text-red-400 gap-1.5"
          >
            {resetMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            {t('configureAmsSlot.resetSlot', 'Reset Slot')}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => configureMutation.mutate()}
              disabled={isSaving || !selectedMaterial.trim()}
              className="gap-1.5"
            >
              {configureMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {t('configureAmsSlot.configureSlot', 'Configure Slot')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

