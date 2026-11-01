import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProBadge } from '../../components/ProBadge';
import * as ProLicenseContext from '../../contexts/ProLicenseContext';

describe('ProBadge', () => {
  it('renders PRO badge text', () => {
    vi.spyOn(ProLicenseContext, 'useProLicense').mockReturnValue({
      proStatus: undefined,
      isLoading: false,
      isPro: false,
      isTrial: false,
      planName: 'Beginner (Free)',
      maxPrinters: 1,
      expiresAt: 0,
      openUpgradeModal: vi.fn(),
      closeUpgradeModal: vi.fn(),
      isUpgradeModalOpen: false,
      selectedFeature: null,
      activateKey: vi.fn(),
      isActivating: false,
    });

    render(<ProBadge feature="Auto Swap PEI" />);
    expect(screen.getByText('PRO')).toBeInTheDocument();
  });

  it('triggers upgrade modal on click when user is not pro', async () => {
    const openUpgradeModal = vi.fn();
    vi.spyOn(ProLicenseContext, 'useProLicense').mockReturnValue({
      proStatus: undefined,
      isLoading: false,
      isPro: false,
      isTrial: false,
      planName: 'Beginner (Free)',
      maxPrinters: 1,
      expiresAt: 0,
      openUpgradeModal,
      closeUpgradeModal: vi.fn(),
      isUpgradeModalOpen: false,
      selectedFeature: null,
      activateKey: vi.fn(),
      isActivating: false,
    });

    const user = userEvent.setup();
    render(<ProBadge feature="Auto Swap PEI" />);

    const badge = screen.getByText('PRO');
    await user.click(badge);

    expect(openUpgradeModal).toHaveBeenCalledWith('Auto Swap PEI');
  });
});
