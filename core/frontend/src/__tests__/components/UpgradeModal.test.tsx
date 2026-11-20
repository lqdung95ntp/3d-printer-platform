import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UpgradeModal } from '../../components/UpgradeModal';
import * as ProLicenseContext from '../../contexts/ProLicenseContext';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

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

    const { container } = renderWithQueryClient(<UpgradeModal />);
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
    renderWithQueryClient(<UpgradeModal />);

    // Verify modal header & feature highlight
    expect(screen.getByText(/ELEVATE YOUR 3D PRINTING AUTOMATION/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Auto Swap PEI/i).length).toBeGreaterThan(0);

    // Verify plans exist on plans tab
    expect(screen.getByText('Hobby')).toBeInTheDocument();
    expect(screen.getByText('Farm Pro')).toBeInTheDocument();
    expect(screen.getByText('Farm Max')).toBeInTheDocument();
    expect(screen.getByText(/Large Farm \/ Enterprise/i)).toBeInTheDocument();

    // Verify currency switcher buttons
    expect(screen.getByRole('button', { name: /USD \(\$\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /VND \(₫\)/i })).toBeInTheDocument();

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
    renderWithQueryClient(<UpgradeModal />);

    // Navigate to activate tab
    const activateTab = screen.getByRole('button', { name: /Activate License Key/i });
    await user.click(activateTab);

    const input = screen.getByPlaceholderText(/bee_license\.key/i);
    await user.type(input, 'BEE-PRO-1234-5678-ABCD');

    const activateBtn = screen.getByRole('button', { name: /Activate Now/i });
    await user.click(activateBtn);

    expect(activateKey).toHaveBeenCalledWith('BEE-PRO-1234-5678-ABCD');
  });

  it('polls check-order without farm_id and rejects lower-tier pre-existing license', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(global, 'fetch');
    const activateKey = vi.fn().mockResolvedValue(true);

    vi.spyOn(ProLicenseContext, 'useProLicense').mockReturnValue({
      proStatus: {
        is_active: true,
        license: { plan: 'farm_pro', max_printers: 15, is_active: true } as any,
      } as any,
      isLoading: false,
      isPro: true,
      isTrial: false,
      planName: 'Farm Pro (6–15 printers)',
      maxPrinters: 15,
      expiresAt: 0,
      openUpgradeModal: vi.fn(),
      closeUpgradeModal: vi.fn(),
      isUpgradeModalOpen: true,
      selectedFeature: null,
      activateKey,
      isActivating: false,
    });

    // Mock fetch to simulate an old lower-tier license being returned
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        paid: true,
        plan: 'Hobby',
        license_token: 'fake-token-hobby',
      }),
    } as any);

    renderWithQueryClient(<UpgradeModal />);

    // Switch to VietQR tab
    const qrTab = screen.getByRole('button', { name: /VietQR Payment/i });
    fireEvent.click(qrTab);

    // Fast-forward interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    // Verify check-order URL was queried without farm_id parameter
    expect(fetchSpy).toHaveBeenCalled();
    const checkOrderCall = fetchSpy.mock.calls.find(call =>
      typeof call[0] === 'string' && call[0].includes('/api/v1/pro/payments/check-order')
    );
    expect(checkOrderCall).toBeDefined();
    expect(checkOrderCall![0]).not.toContain('farm_id=');

    // Because current selected plan for upgrade from Farm Pro is Farm Max, Hobby must be rejected!
    expect(activateKey).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    vi.useRealTimers();
  });
});
