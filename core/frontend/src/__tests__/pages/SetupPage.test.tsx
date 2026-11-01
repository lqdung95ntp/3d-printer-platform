/**
 * Tests for the SetupPage component.
 */

import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../utils';
import { SetupPage } from '../../pages/SetupPage';

describe('SetupPage', () => {
  it('uses the full Printbuddy app icon in the setup branding', () => {
    render(<SetupPage />);

    const icon = screen.getByAltText('Printbuddy app icon') as HTMLImageElement;
    expect(icon).toBeInTheDocument();
    expect(icon.getAttribute('src')).toContain('/img/printbuddy_icon.png');
    expect(icon).not.toHaveAttribute('src', expect.stringContaining('printbuddy_logo.svg'));
  });

  it('renders customized branding and titles', () => {
    render(<SetupPage />);

    expect(screen.getByText('3D Printer')).toBeInTheDocument();
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Farm Setup')).toBeInTheDocument();
    expect(screen.getByText('Configure authentication for your printers instance')).toBeInTheDocument();
    expect(screen.getByText(/Powered by/i)).toBeInTheDocument();
    const beeLink = screen.getByRole('link', { name: 'BeE STEM Solutions' });
    expect(beeLink).toBeInTheDocument();
    expect(beeLink).toHaveAttribute('href', 'https://beestemsolutions.com.vn');
    expect(beeLink).toHaveAttribute('target', '_blank');
    expect(beeLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
