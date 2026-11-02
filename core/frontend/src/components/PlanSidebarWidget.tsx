import { Zap, Crown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useProLicense } from '../contexts/ProLicenseContext';

interface PlanSidebarWidgetProps {
  isExpanded: boolean;
}

export function PlanSidebarWidget({ isExpanded }: PlanSidebarWidgetProps) {
  const { isPro, isTrial, planName, maxPrinters, openUpgradeModal } = useProLicense();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    staleTime: 60 * 1000,
  });

  const isVND = (settings?.currency || 'USD').toUpperCase() === 'VND';
  const priceDisplay = isVND ? '69k' : '$4.99';

  const planShortName = isPro
    ? planName.includes('Hobby')
      ? 'Hobby Pro'
      : planName.includes('Farm Max')
      ? 'Farm Max'
      : planName.includes('Farm Pro')
      ? 'Farm Pro'
      : planName.includes('Enterprise')
      ? 'Enterprise'
      : isTrial
      ? '7-Day Trial'
      : 'BeE Pro'
    : isTrial
    ? '7-Day Trial'
    : 'Beginner';

  const printerQuota = maxPrinters === -1 ? 'Unlimited' : maxPrinters === 1 ? '1 printer' : `1–${maxPrinters} printers`;

  if (!isExpanded) {
    return (
      <div className="flex justify-center p-2">
        <button
          type="button"
          onClick={() => openUpgradeModal()}
          title={`Current Plan: ${planName} — Click to upgrade or manage`}
          className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 text-amber-300 transition-all hover:scale-105 active:scale-95 shadow-md group relative"
        >
          {isPro ? (
            <Crown className="w-5 h-5 text-amber-400 fill-amber-400" />
          ) : (
            <Zap className="w-5 h-5 text-amber-400 fill-amber-400 animate-pulse" />
          )}
          <span className="sr-only">Upgrade to Pro</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mx-2 mb-2 p-2.5 rounded-xl bg-gradient-to-br from-bambu-dark to-bambu-dark-secondary border border-bambu-dark-tertiary/70 shadow-sm text-left">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isPro
                ? 'bg-bambu-green/15 text-bambu-green border border-bambu-green/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            {isPro ? (
              <Crown className="w-4 h-4 fill-current" />
            ) : (
              <Zap className="w-4 h-4 fill-current" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
              <span>{planShortName}</span>
              {isPro && (
                <span className="w-1.5 h-1.5 rounded-full bg-bambu-green animate-pulse shrink-0" />
              )}
            </div>
            <div className="text-[11px] text-bambu-gray truncate">
              {printerQuota}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => openUpgradeModal()}
        className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
          isPro
            ? 'bg-bambu-dark-tertiary hover:bg-bambu-gray/20 text-bambu-gray hover:text-white border border-bambu-dark-tertiary'
            : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-amber-500/10'
        }`}
      >
        <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
        <span>{isPro ? 'Manage License' : `Upgrade Pro (${priceDisplay})`}</span>
      </button>
    </div>
  );
}
