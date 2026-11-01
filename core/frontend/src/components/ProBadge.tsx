import { Zap } from 'lucide-react';
import { useProLicense } from '../contexts/ProLicenseContext';

interface ProBadgeProps {
  feature?: string;
  className?: string;
  showIcon?: boolean;
}

export function ProBadge({ feature, className = '', showIcon = true }: ProBadgeProps) {
  const { isPro, openUpgradeModal } = useProLicense();

  if (isPro) {
    return null; // Already Pro, no badge needed
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openUpgradeModal(feature);
      }}
      title={`Tính năng PRO ${feature ? `(${feature})` : ''} - Nhấn để nâng cấp hoặc dùng thử`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider uppercase bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 hover:border-amber-400 hover:text-amber-200 hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer ${className}`}
    >
      {showIcon && <Zap className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />}
      <span>PRO</span>
    </button>
  );
}

