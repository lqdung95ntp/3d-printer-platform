import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProStatus, activateLicenseKey, type ProStatusResponse } from '../api/beePro';
import { useToast } from './ToastContext';

interface ProLicenseContextType {
  proStatus: ProStatusResponse | undefined;
  isLoading: boolean;
  isPro: boolean;
  isTrial: boolean;
  planName: string;
  maxPrinters: number;
  expiresAt: number;
  openUpgradeModal: (featureName?: string) => void;
  closeUpgradeModal: () => void;
  isUpgradeModalOpen: boolean;
  selectedFeature: string | null;
  activateKey: (key: string) => Promise<boolean>;
  isActivating: boolean;
}

const ProLicenseContext = createContext<ProLicenseContextType | undefined>(undefined);

export function ProLicenseProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  const { data: proStatus, isLoading } = useQuery({
    queryKey: ['proStatus'],
    queryFn: fetchProStatus,
    staleTime: 60 * 1000,
  });

  const activateMutation = useMutation({
    mutationFn: activateLicenseKey,
    onSuccess: (data) => {
      showToast(data.message || 'Kích hoạt bản quyền Pro thành công!', 'success');
      queryClient.invalidateQueries({ queryKey: ['proStatus'] });
      setIsUpgradeModalOpen(false);
    },
    onError: (err: Error) => {
      showToast(err.message || 'Kích hoạt bản quyền thất bại', 'error');
    },
  });

  const license = proStatus?.license;
  const plan = license?.plan?.toLowerCase() || 'community';
  const isActive = license?.is_active ?? false;

  const isPro = isActive && plan !== 'community' && plan !== 'expired';
  const isTrial = plan.includes('trial');
  const maxPrinters = license?.max_printers ?? 1;
  const expiresAt = license?.expires_at ?? 0;

  // Human readable plan name
  let planName = 'Beginner (Free)';
  if (plan === 'hobby') planName = 'Hobby Pro (1–5 máy)';
  else if (plan === 'farm' || plan === 'farm_pro') planName = 'Farm Pro (6–15 máy)';
  else if (plan === 'farm_max') planName = 'Farm Max (16–30 máy)';
  else if (plan === 'enterprise') planName = 'Enterprise';
  else if (isTrial) planName = 'Dùng thử Pro 7 ngày';
  else if (isPro) planName = 'BeE Pro';

  const openUpgradeModal = (featureName?: string) => {
    setSelectedFeature(featureName || null);
    setIsUpgradeModalOpen(true);
  };

  const closeUpgradeModal = () => {
    setIsUpgradeModalOpen(false);
    setSelectedFeature(null);
  };

  const activateKey = async (key: string): Promise<boolean> => {
    try {
      await activateMutation.mutateAsync(key);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <ProLicenseContext.Provider
      value={{
        proStatus,
        isLoading,
        isPro,
        isTrial,
        planName,
        maxPrinters,
        expiresAt,
        openUpgradeModal,
        closeUpgradeModal,
        isUpgradeModalOpen,
        selectedFeature,
        activateKey,
        isActivating: activateMutation.isPending,
      }}
    >
      {children}
    </ProLicenseContext.Provider>
  );
}

export function useProLicense() {
  const context = useContext(ProLicenseContext);
  if (!context) {
    throw new Error('useProLicense must be used within a ProLicenseProvider');
  }
  return context;
}

