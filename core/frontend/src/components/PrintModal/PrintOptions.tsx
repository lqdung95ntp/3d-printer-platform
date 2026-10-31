import { useEffect, useState } from 'react';
import { Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PrintOptionsProps, PrintOptions as PrintOptionsType } from './types';
import {
  CALIBRATION_MODE_ACTIVE,
  CALIBRATION_MODE_INACTIVE,
} from '../../utils/calibrationMode';

const PRINT_OPTIONS_CONFIG: Array<{
  key: keyof PrintOptionsType;
  label: string;
  desc: string;
  layerInspectOnly?: boolean;
}> = [
  { key: 'bed_levelling', label: 'Bed Levelling', desc: 'Auto-level bed before print' },
  { key: 'flow_cali', label: 'Flow Calibration', desc: 'Calibrate extrusion flow' },
  { key: 'vibration_cali', label: 'Vibration Calibration', desc: 'Reduce ringing artifacts' },
  { key: 'layer_inspect', label: 'First Layer Inspection', desc: 'AI inspection of first layer', layerInspectOnly: true },
  { key: 'timelapse', label: 'Timelapse', desc: 'Record timelapse video' },
];

const BOOLEAN_MODES = ['off', 'on'] as const;

/**
 * Print options toggle panel with collapsible UI.
 * Shows bed levelling, flow/vibration calibration, layer inspection, and timelapse options.
 */
export function PrintOptionsPanel({
  options,
  onChange,
  defaultExpanded = false,
  supportedOptions,
  showLayerInspectOptions = true,
}: PrintOptionsProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);
  const visibleOptions = PRINT_OPTIONS_CONFIG.filter(
    ({ key, layerInspectOnly }) =>
      (!supportedOptions || supportedOptions.includes(key)) &&
      (!layerInspectOnly || showLayerInspectOptions),
  );

  const handleToggle = (key: keyof PrintOptionsType, val: boolean) => {
    onChange({ ...options, [key]: val });
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-bambu-gray hover:text-white transition-colors w-full"
      >
        <Settings className="w-4 h-4" />
        <span>Print Options</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 ml-auto" />
        ) : (
          <ChevronDown className="w-4 h-4 ml-auto" />
        )}
      </button>
      {isExpanded && (
        <div className="mt-2 bg-bambu-dark rounded-lg p-3 space-y-2">
          {visibleOptions.length === 0 ? (
            <p className="text-xs text-bambu-gray">No configurable print options for the selected printer.</p>
          ) : visibleOptions.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <div>
                <span className="text-sm text-white">{label}</span>
                <p className="text-xs text-bambu-gray">{desc}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {BOOLEAN_MODES.map((mode) => {
                  const active = (options[key] ? 'on' : 'off') === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleToggle(key, mode === 'on')}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${
                        active ? CALIBRATION_MODE_ACTIVE[mode] : CALIBRATION_MODE_INACTIVE
                      }`}
                    >
                      {t(`settings.calibrationMode_${mode}`, mode === 'off' ? 'Off' : 'On')}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
