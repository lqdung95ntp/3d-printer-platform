import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpgradeModal } from '../../components/UpgradeModal';
import * as ProLicenseContext from '../../contexts/ProLicenseContext';

describe('UpgradeModal', () => {
  it('does not render when isUpgradeModalOpen is false', () => {
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

    const { container } = render(<UpgradeModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all plan cards and switches tabs when open', async () => {
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
      isUpgradeModalOpen: true,
      selectedFeature: 'Auto Swap PEI',
      activateKey: vi.fn(),
      isActivating: false,
    });

    const user = userEvent.setup();
    render(<UpgradeModal />);

    // Verify modal header & feature highlight
    expect(screen.getByText(/ELEVATE YOUR 3D PRINTING AUTOMATION/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Auto Swap PEI/i).length).toBeGreaterThan(0);

    // Verify plans exist on plans tab
    expect(screen.getByText('Hobby')).toBeInTheDocument();
    expect(screen.getByText('Farm Pro')).toBeInTheDocument();
    expect(screen.getByText('Farm Max')).toBeInTheDocument();
    expect(screen.getByText(/Large Farm \/ Enterprise/i)).toBeInTheDocument();

    // Switch to VietQR tab
    const qrTab = screen.getByRole('button', { name: /VietQR Payment/i });
    await user.click(qrTab);
    expect(screen.getByText(/Automated Payment Details/i)).toBeInTheDocument();

    // Switch to Activate Key tab
    const activateTab = screen.getByRole('button', { name: /Activate License Key/i });
    await user.click(activateTab);
    expect(screen.getByPlaceholderText(/bee_license\.key/i)).toBeInTheDocument();
  });

  it('allows entering license key and submitting activation', async () => {
    const activateKey = vi.fn().mockResolvedValue(true);
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
      isUpgradeModalOpen: true,
      selectedFeature: null,
      activateKey,
      isActivating: false,
    });

    const user = userEvent.setup();
    render(<UpgradeModal />);

    // Navigate to activate tab
    const activateTab = screen.getByRole('button', { name: /Activate License Key/i });
    await user.click(activateTab);

    const input = screen.getByPlaceholderText(/bee_license\.key/i);
    await user.type(input, 'BEE-PRO-1234-5678-ABCD');

    const activateBtn = screen.getByRole('button', { name: /Activate Now/i });
    await user.click(activateBtn);

    expect(activateKey).toHaveBeenCalledWith('BEE-PRO-1234-5678-ABCD');
  });
});
