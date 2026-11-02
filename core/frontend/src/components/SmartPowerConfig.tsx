import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Zap,
  Power,
  Clock,
  ShieldCheck,
  RotateCw,
  Loader2,
  Leaf,
} from 'lucide-react';
import { Button } from './Button';
import { Card, CardContent, CardHeader } from './Card';
import { ProBadge } from './ProBadge';
import { useProLicense } from '../contexts/ProLicenseContext';
import { useToast } from '../contexts/ToastContext';
import { type Printer, type SmartPlug } from '../api/client';
import {
  fetchSmartPowerStatus,
  updateSmartPowerGlobalConfig,
  updatePrinterSmartPowerConfig,
  triggerPrinterPowerOff,
  triggerPrinterPowerOn,
  type SmartPowerStatusResponse,
} from '../api/beePro';

interface SmartPowerConfigProps {
  printers: Printer[];
  smartPlugs: SmartPlug[];
}

export function SmartPowerConfig({ printers, smartPlugs }: SmartPowerConfigProps) {
  const { t } = useTranslation();
  const { isPro, openUpgradeModal } = useProLicense();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [idleMinutes, setIdleMinutes] = useState(30);
  const [prewakeMinutes, setPrewakeMinutes] = useState(3);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Query Smart Power telemetry
  const { data: spStatus, refetch } = useQuery<SmartPowerStatusResponse>({
    queryKey: ['proSmartPowerStatus'],
    queryFn: fetchSmartPowerStatus,
    enabled: isPro,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (spStatus) {
      setGlobalEnabled(spStatus.enabled);
      setIdleMinutes(spStatus.idle_auto_off_minutes);
      setPrewakeMinutes(spStatus.prewake_minutes);
    }
  }, [spStatus]);

  // Global Config Mutation
  const globalMutation = useMutation({
    mutationFn: updateSmartPowerGlobalConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proSmartPowerStatus'] });
      showToast(t('settings.smartPower.saveSuccess', 'Smart Power settings saved successfully!'), 'success');
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to save settings', 'error');
    },
  });

  const handleSaveGlobal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPro) {
      openUpgradeModal('Smart Power');
      return;
    }
    globalMutation.mutate({
      enabled: globalEnabled,
      idle_auto_off_minutes: Number(idleMinutes) || 30,
      prewake_minutes: Number(prewakeMinutes) || 3,
    });
  };

  const handleTogglePrinter = async (printerId: number, currentlyEnabled: boolean) => {
    if (!isPro) {
      openUpgradeModal('Smart Power');
      return;
    }
    try {
      await updatePrinterSmartPowerConfig(printerId, { enabled: !currentlyEnabled });
      refetch();
      showToast('Updated printer configuration', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update printer config', 'error');
    }
  };

  const handlePowerAction = async (printerId: number, action: 'on' | 'off') => {
    if (!isPro) {
      openUpgradeModal('Smart Power');
      return;
    }
    setActionLoadingId(printerId);
    try {
      if (action === 'on') {
        await triggerPrinterPowerOn(printerId);
        showToast(t('printers.toast.powerOnSuccess', 'Turned ON printer power successfully'), 'success');
      } else {
        await triggerPrinterPowerOff(printerId);
        showToast(t('printers.toast.powerOffSuccess', 'Turned OFF printer power successfully'), 'success');
      }
      refetch();
    } catch (err: any) {
      showToast(err.message || `Failed to turn ${action} printer power`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Find linked smart plug for a printer
  const getLinkedPlug = (printerId: number) => {
    if (spStatus?.printer_plug_map?.[printerId]) {
      const mappedId = spStatus.printer_plug_map[printerId];
      return smartPlugs.find((p) => p.id === mappedId);
    }
    return smartPlugs.find((p) => p.printer_id === printerId && p.enabled);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-bambu-dark-tertiary bg-gradient-to-r from-emerald-950/40 via-bambu-dark-secondary to-bambu-dark-secondary p-5 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Leaf className="h-6 w-6 text-emerald-400" />
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {t('settings.smartPower.title', 'Smart Power & Auto Energy Saver')}
                <ProBadge feature="Smart Power" />
              </h2>
            </div>
            <p className="text-xs text-bambu-gray max-w-2xl leading-relaxed">
              {t(
                'settings.smartPower.description',
                'Tự động ngắt nguồn máy in thông minh khi hoàn thành in và rảnh rỗi (idle). Tự động bật nguồn trước 3 phút khi có lịch in theo hàng đợi. Giảm thiểu nguy cơ chập cháy và tiết kiệm tiền điện tối đa cho xưởng in.'
              )}
            </p>
          </div>

          {!isPro && (
            <Button
              variant="primary"
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold hover:from-amber-400 hover:to-orange-400 shrink-0"
              onClick={() => openUpgradeModal('Smart Power')}
            >
              <Zap className="w-4 h-4 mr-1.5 fill-black" />
              {t('settings.smartPower.unlockPro', 'Nâng Cấp Mở Khóa (69k/tháng)')}
            </Button>
          )}
        </div>
      </div>

      {/* Global Configuration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Power className="w-4 h-4 text-emerald-400" />
              {t('settings.smartPower.globalSettings', 'Cấu Hình Tự Động Toàn Cụm Máy')}
            </h3>
            {spStatus?.running && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Engine Active
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveGlobal} className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-bambu-dark-tertiary/50">
              <div>
                <label className="text-sm font-medium text-white block">
                  {t('settings.smartPower.enableGlobal', 'Kích hoạt Smart Power Engine')}
                </label>
                <p className="text-xs text-bambu-gray">
                  {t(
                    'settings.smartPower.enableGlobalDesc',
                    'Bật cơ chế theo dõi rảnh rỗi và tự động tắt nguồn qua ổ cắm thông minh.'
                  )}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalEnabled}
                  onChange={(e) => setGlobalEnabled(e.target.checked)}
                  disabled={!isPro}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-bambu-dark-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-bambu-gray flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  {t('settings.smartPower.idleTimeout', 'Thời gian máy in rảnh trước khi ngắt điện (phút)')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={idleMinutes}
                  onChange={(e) => setIdleMinutes(Number(e.target.value))}
                  disabled={!isPro || !globalEnabled}
                  className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                />
                <p className="text-[11px] text-bambu-gray">
                  Mặc định: 30 phút. Máy in sẽ không tắt nếu đang có lệnh in chờ (queue) hoặc đang sấy nhựa AMS.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-bambu-gray flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  {t('settings.smartPower.prewakeTime', 'Tự động bật nguồn trước giờ in theo lịch (phút)')}
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={prewakeMinutes}
                  onChange={(e) => setPrewakeMinutes(Number(e.target.value))}
                  disabled={!isPro || !globalEnabled}
                  className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                />
                <p className="text-[11px] text-bambu-gray">
                  Mặc định: 3 phút. Bật nguồn máy in trước để kịp kết nối WiFi và làm nóng bàn in.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <Button
                type="submit"
                variant="primary"
                disabled={!isPro || globalMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {globalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {t('common.save', 'Lưu Cài Đặt')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Fleet Monitoring & Control */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {t('settings.smartPower.fleetStatus', 'Trạng Thái Từng Máy In')}
            </h3>
            {isPro && (
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-xs text-bambu-gray hover:text-white">
                <RotateCw className="w-3.5 h-3.5 mr-1" />
                Làm mới
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {printers.length === 0 ? (
            <p className="text-xs text-bambu-gray italic py-4">Chưa có máy in nào được cấu hình trong hệ thống.</p>
          ) : (
            <div className="divide-y divide-bambu-dark-tertiary/40">
              {printers.map((printer) => {
                const plug = getLinkedPlug(printer.id);
                const idleInfo = spStatus?.tracked_idle_printers?.[printer.id];
                const printerCfg = spStatus?.printer_configs?.[printer.id];
                const isPrinterEnabled = printerCfg?.enabled !== false;
                const isPowerActionPending = actionLoadingId === printer.id;

                return (
                  <div key={printer.id} className="py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{printer.name}</span>
                        <span className="text-xs text-bambu-gray">({printer.model || 'Bambu Lab'})</span>
                        {isPrinterEnabled ? (
                          <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                            Auto-Off ON
                          </span>
                        ) : (
                          <span className="text-[10px] text-bambu-gray bg-bambu-dark-tertiary px-1.5 py-0.2 rounded">
                            Disabled
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-bambu-gray">
                        <span>
                          Ổ cắm liên kết:{' '}
                          {plug ? (
                            <span className="text-white font-medium">
                              {plug.name} ({plug.plug_type.toUpperCase()})
                            </span>
                          ) : (
                            <span className="text-amber-400 italic">Chưa gán Smart Plug</span>
                          )}
                        </span>

                        {idleInfo && (
                          <span className="text-amber-300 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            Đang rảnh: {idleInfo.idle_minutes} phút
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                      {plug && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!isPro || isPowerActionPending}
                            onClick={() => handlePowerAction(printer.id, 'on')}
                            className="text-xs bg-emerald-950/40 text-emerald-300 border-emerald-800/40 hover:bg-emerald-900/60"
                          >
                            {isPowerActionPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Zap className="w-3.5 h-3.5 mr-1 text-emerald-400" />}
                            Bật Nguồn
                          </Button>

                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!isPro || isPowerActionPending}
                            onClick={() => handlePowerAction(printer.id, 'off')}
                            className="text-xs bg-red-950/40 text-red-300 border-red-800/40 hover:bg-red-900/60"
                          >
                            {isPowerActionPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Power className="w-3.5 h-3.5 mr-1 text-red-400" />}
                            Tắt Nguồn
                          </Button>
                        </>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!isPro}
                        onClick={() => handleTogglePrinter(printer.id, isPrinterEnabled)}
                        className="text-xs text-bambu-gray hover:text-white"
                      >
                        {isPrinterEnabled ? 'Tắt Smart Power' : 'Bật Smart Power'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
