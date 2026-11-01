import { Zap, Crown, Sparkles } from 'lucide-react';
import { useProLicense } from '../contexts/ProLicenseContext';

interface PlanSidebarWidgetProps {
  isExpanded: boolean;
}

export function PlanSidebarWidget({ isExpanded }: PlanSidebarWidgetProps) {
  const { isPro, isTrial, planName, maxPrinters, openUpgradeModal } = useProLicense();

  if (!isExpanded) {
    return (
      <div className="flex justify-center p-2">
        <button
          type="button"
          onClick={() => openUpgradeModal()}
          title={`Gói hiện tại: ${planName} — Nhấn để nâng cấp hoặc quản lý gói`}
          className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 text-amber-300 transition-all hover:scale-105 active:scale-95 shadow-md group relative"
        >
          {isPro ? (
            <Crown className="w-5 h-5 text-amber-400 fill-amber-400" />
          ) : (
            <Zap className="w-5 h-5 text-amber-400 fill-amber-400 animate-pulse" />
          )}
          <span className="sr-only">Nâng cấp Pro</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mx-2 mb-2 p-3 rounded-xl bg-gradient-to-br from-bambu-dark to-bambu-dark-secondary border border-bambu-dark-tertiary shadow-sm text-left">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-bambu-gray flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Gói Dịch Vụ
        </span>
        {isPro ? (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-bambu-green/20 text-bambu-green border border-bambu-green/30">
            PRO ({maxPrinters === -1 ? '∞' : maxPrinters} máy)
          </span>
        ) : isTrial ? (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            TRIAL 7 NGÀY
          </span>
        ) : (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-bambu-gray/20 text-bambu-gray border border-bambu-dark-tertiary">
            BEGINNER
          </span>
        )}
      </div>

      <div className="text-xs font-semibold text-white truncate mb-2">
        {planName}
      </div>

      <button
        type="button"
        onClick={() => openUpgradeModal()}
        className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
          isPro
            ? 'bg-bambu-dark-tertiary hover:bg-bambu-gray/20 text-white'
            : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-amber-500/10'
        }`}
      >
        <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
        <span>{isPro ? 'Quản Lý Bản Quyền' : 'Nâng Cấp Pro (69k)'}</span>
      </button>
    </div>
  );
}

