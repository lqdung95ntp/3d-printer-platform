import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2, Save, Send } from 'lucide-react';
import { Button } from './Button';
import { useToast } from '../contexts/ToastContext';
import { api, type Printer as ClientPrinter, type PrinterStatus } from '../api/client';

export interface PrinterSwapPeiConfigProps {
  printer: ClientPrinter;
  onSave: (autoSwap: boolean, gcode: string) => void;
  isSaving: boolean;
}

export function PrinterSwapPeiConfig({ printer, onSave, isSaving }: PrinterSwapPeiConfigProps) {
  const [localAutoSwap, setLocalAutoSwap] = useState(printer.auto_swap || false);
  const [localGcode, setLocalGcode] = useState(printer.swap_pei_gcode || '');
  const [isTesting, setIsTesting] = useState(false);

  const { showToast } = useToast();
  const { t } = useTranslation();

  // Fetch real-time printer status
  const { data: status } = useQuery<PrinterStatus>({
    queryKey: ['printerStatus', printer.id],
    queryFn: () => api.getPrinterStatus(printer.id),
    refetchInterval: 5000,
  });

  const canSwap = status?.connected && (status?.state === 'IDLE' || status?.state === 'FINISH' || status?.state === 'FAILED');

  useEffect(() => {
    setLocalAutoSwap(printer.auto_swap || false);
    setLocalGcode(printer.swap_pei_gcode || '');
  }, [printer]);

  const hasChanged = localAutoSwap !== (printer.auto_swap || false) || localGcode !== (printer.swap_pei_gcode || '');

  const handleTestSwap = async () => {
    setIsTesting(true);
    try {
      const res = await api.swapPei(printer.id);
      showToast(res.message || t('printers.toast.swapPeiTriggered', 'Swap PEI macro triggered successfully'), 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to trigger test swap';
      showToast(msg, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-4 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <span className="text-sm font-semibold text-white">{printer.name}</span>
          <span className="text-xs text-bambu-gray ml-2">({printer.model || 'Unknown Model'})</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label htmlFor={`auto_swap_${printer.id}`} className="text-xs text-bambu-gray cursor-pointer select-none">
          Enable Auto Swap PEI option for this printer
        </label>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            id={`auto_swap_${printer.id}`}
            checked={localAutoSwap}
            onChange={(e) => setLocalAutoSwap(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-bambu-dark-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bambu-green"></div>
        </label>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-bambu-gray">Swap PEI G-code Macro</label>
        <textarea
          value={localGcode}
          onChange={(e) => setLocalGcode(e.target.value)}
          placeholder="Enter G-code lines..."
          rows={8}
          className="w-full font-mono text-xs p-2.5 bg-bambu-dark-secondary border border-bambu-dark-tertiary rounded-lg text-white focus:outline-none focus:border-bambu-green"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={isTesting || isSaving || hasChanged || !printer.swap_pei_gcode?.trim() || !canSwap}
          onClick={handleTestSwap}
          title={
            !printer.swap_pei_gcode?.trim()
              ? 'Save a macro first to test it'
              : hasChanged
              ? 'Save changes before testing the macro'
              : !canSwap
              ? 'Printer is busy or disconnected'
              : 'Test the Swap PEI macro on this printer'
          }
        >
          {isTesting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
          Test Swap PEI
        </Button>
        <Button
          size="sm"
          disabled={!hasChanged || isSaving || isTesting}
          onClick={() => onSave(localAutoSwap, localGcode)}
        >
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
