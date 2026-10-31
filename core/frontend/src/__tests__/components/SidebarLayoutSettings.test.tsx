import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExternalLinksSettings } from '../../components/ExternalLinksSettings';
import {
  getHiddenSidebarSystemItemIds,
} from '../../utils/sidebarLayout';

vi.mock('../../api/client', () => ({
  api: {
    getExternalLinks: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue({ default_sidebar_order: '' }),
    updateSettings: vi.fn().mockResolvedValue({}),
    getExternalLinkIconUrl: vi.fn((id) => `/api/external-links/${id}/icon`),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, role: 'admin' },
    authEnabled: true,
    hasPermission: () => true,
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

describe('ExternalLinksSettings (Sidebar Layout)', () => {
  let queryClient: QueryClient;
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => store[key] ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key: string, val: string) => {
      store[key] = String(val);
    });
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      delete store[key];
    });
    vi.mocked(localStorage.clear).mockImplementation(() => {
      store = {};
    });

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('renders built-in pages list with visibility toggles', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ExternalLinksSettings />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Printers')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Visible in sidebar').length).toBeGreaterThan(0);
    expect(screen.getByText('Required in sidebar')).toBeInTheDocument();
  });

  it('toggles visibility of built-in pages and updates localStorage', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ExternalLinksSettings />
      </QueryClientProvider>
    );

    // Wait until full component settles
    await waitFor(() => {
      expect(screen.getByText('Printers')).toBeInTheDocument();
      expect(screen.getByText('Set Default')).toBeInTheDocument();
    });

    const hideButtons = screen.getAllByRole('button', { name: /Hide page/i });
    expect(hideButtons.length).toBeGreaterThan(0);

    fireEvent.click(hideButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Hidden from sidebar')).toBeInTheDocument();
      expect(getHiddenSidebarSystemItemIds()).toContain('printers');
    });

    const showButton = await screen.findByRole('button', { name: /Show page/i });
    fireEvent.click(showButton);

    await waitFor(() => {
      expect(getHiddenSidebarSystemItemIds()).not.toContain('printers');
    });
  });

  it('does not allow hiding Settings', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ExternalLinksSettings />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    const settingsHideBtn = screen.getByRole('button', { name: /Settings cannot be hidden/i });
    expect(settingsHideBtn).toBeDisabled();
  });
});
