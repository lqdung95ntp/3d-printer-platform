export interface LicenseStatus {
  is_active: boolean;
  plan: string;
  customer: string;
  max_printers: number;
  expires_at: number;
  features: string[];
  message: string;
}

export interface ProStatusResponse {
  sidecar_version: string;
  license: LicenseStatus;
  engines: {
    auto_swap_pei: boolean;
    smart_power: boolean;
  };
  fleet?: {
    total_printers: number;
    quota: number;
  };
}

export async function fetchProStatus(): Promise<ProStatusResponse> {
  try {
    const res = await fetch('/api/v1/pro/status');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.debug('Failed to fetch Pro status:', e);
  }
  return {
    sidecar_version: 'Offline',
    license: {
      is_active: false,
      plan: 'community',
      customer: 'Community Edition',
      max_printers: 3,
      expires_at: 0,
      features: ['basic_monitoring'],
      message: 'Running in Community Mode (Max 3 printers).',
    },
    engines: {
      auto_swap_pei: false,
      smart_power: false,
    },
  };
}

export async function activateLicenseKey(licenseKey: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/v1/pro/license/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ license_key: licenseKey }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to activate license');
  }
  return data;
}
