import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { SkipObjectsModal } from '../../components/SkipObjectsModal';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    getPrinterStatus: vi.fn(),
    getPrintableObjects: vi.fn(),
    skipObjects: vi.fn(),
  },
  withMediaToken: vi.fn((url: string) => url),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

function renderModal(printerId = 1, isOpen = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <SkipObjectsModal printerId={printerId} isOpen={isOpen} onClose={onClose} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return { onClose };
}

describe('SkipObjectsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders VectorBedViewer when objects contain vector polygons (e.g. Snapmaker U1)', async () => {
    vi.mocked(api.getPrinterStatus).mockResolvedValue({
      state: 'RUNNING',
      layer_num: 5,
      cover_url: '/api/v1/printers/1/cover',
    } as any);

    vi.mocked(api.getPrintableObjects).mockResolvedValue({
      objects: [
        {
          id: 1,
          name: 'Part1.STL',
          skipped: false,
          polygon: [[10, 10], [50, 10], [50, 50], [10, 50]],
          center: [30, 30],
        },
        {
          id: 2,
          name: 'Part2.STL',
          skipped: false,
          polygon: [[60, 60], [100, 60], [100, 100], [60, 100]],
          center: [80, 80],
        },
      ],
      total: 2,
      skipped_count: 0,
      bbox_all: [10, 10, 100, 100],
      bed_size: [250, 250],
    } as any);

    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Part1.STL')).toBeInTheDocument();
      expect(screen.getByText('Part2.STL')).toBeInTheDocument();
    });

    // VectorBedViewer canvas should be rendered, not a broken img
    expect(screen.getByLabelText(/vector bed preview/i)).toBeInTheDocument();
    expect(screen.queryByAltText(/print preview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
  });

  it('renders raster image and overlay when printer has no vector polygons', async () => {
    vi.mocked(api.getPrinterStatus).mockResolvedValue({
      state: 'RUNNING',
      layer_num: 5,
      cover_url: '/api/v1/printers/2/cover',
    } as any);

    vi.mocked(api.getPrintableObjects).mockResolvedValue({
      objects: [
        {
          id: 1,
          name: 'BambuPart.STL',
          skipped: false,
        },
      ],
      total: 1,
      skipped_count: 0,
      bbox_all: null,
    } as any);

    renderModal(2);

    await waitFor(() => {
      expect(screen.getByText('BambuPart.STL')).toBeInTheDocument();
    });

    // Raster top-view preview img should be rendered for Bambu-style plates
    expect(screen.getByAltText(/print preview/i)).toBeInTheDocument();
  });

  it('handles raster top-view image loading error gracefully without leaving broken image', async () => {
    vi.mocked(api.getPrinterStatus).mockResolvedValue({
      state: 'RUNNING',
      layer_num: 5,
      cover_url: '/api/v1/printers/3/cover',
    } as any);

    vi.mocked(api.getPrintableObjects).mockResolvedValue({
      objects: [
        {
          id: 1,
          name: 'SomePart.STL',
          skipped: false,
        },
      ],
      total: 1,
      skipped_count: 0,
      bbox_all: null,
    } as any);

    renderModal(3);

    await waitFor(() => {
      expect(screen.getByText('SomePart.STL')).toBeInTheDocument();
    });

    const img = screen.getByAltText(/print preview/i);
    // Simulate image load error
    img.dispatchEvent(new Event('error'));

    await waitFor(() => {
      expect(screen.queryByAltText(/print preview/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
    });
  });
});
