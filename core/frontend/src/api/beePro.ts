import { getAuthToken } from "./client";

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
		xiaozhi_voice?: boolean;
	};
	fleet?: {
		total_printers: number;
		quota: number;
	};
}

export interface SmartPowerStatusResponse {
	running: boolean;
	enabled: boolean;
	idle_auto_off_minutes: number;
	prewake_minutes: number;
	license_active: boolean;
	printer_configs: Record<
		string,
		{ enabled?: boolean; idle_minutes?: number; smart_plug_id?: number }
	>;
	printer_plug_map: Record<string, number>;
	tracked_idle_printers: Record<
		string,
		{ idle_seconds: number; idle_minutes: number }
	>;
}

export async function fetchProStatus(): Promise<ProStatusResponse> {
	try {
		const token = getAuthToken();
		const headers: Record<string, string> = {};
		if (token) headers["Authorization"] = `Bearer ${token}`;

		const res = await fetch("/api/v1/pro/status", { headers });
		if (res.ok) {
			return await res.json();
		}
	} catch (e) {
		console.debug("Failed to fetch Pro status:", e);
	}
	return {
		sidecar_version: "Offline",
		license: {
			is_active: false,
			plan: "community",
			customer: "Community Edition",
			max_printers: 1,
			expires_at: 0,
			features: ["basic_monitoring"],
			message: "Running in Community Mode (Max 1 printer).",
		},
		engines: {
			auto_swap_pei: false,
			smart_power: false,
		},
	};
}

export async function activateLicenseKey(
	licenseKey: string,
): Promise<{ success: boolean; message: string }> {
	const token = getAuthToken();
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (token) headers["Authorization"] = `Bearer ${token}`;

	const res = await fetch("/api/v1/pro/license/activate", {
		method: "POST",
		headers,
		body: JSON.stringify({ license_key: licenseKey }),
	});
	const data = await res.json();
	if (!res.ok) {
		throw new Error(data.detail || "Failed to activate license");
	}
	return data;
}

export async function activateTrialLicense(
	farmName?: string,
): Promise<{ success: boolean; message: string }> {
	const token = getAuthToken();
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (token) headers["Authorization"] = `Bearer ${token}`;

	const res = await fetch("/api/v1/pro/license/trial", {
		method: "POST",
		headers,
		body: JSON.stringify({ farm_name: farmName || "" }),
	});
	const data = await res.json();
	if (!res.ok) {
		throw new Error(
			data.detail || data.message || "Không thể kích hoạt dùng thử",
		);
	}
	return data;
}

export async function fetchSmartPowerStatus(): Promise<SmartPowerStatusResponse> {
	const token = getAuthToken();
	const headers: Record<string, string> = {};
	if (token) headers["Authorization"] = `Bearer ${token}`;

	const res = await fetch("/api/v1/pro/smart-power/status", { headers });
	if (!res.ok) {
		throw new Error("Failed to fetch Smart Power status");
	}
	return await res.json();
}

export async function updateSmartPowerGlobalConfig(config: {
	enabled?: boolean;
	idle_auto_off_minutes?: number;
	prewake_minutes?: number;
}): Promise<{ success: boolean; config: SmartPowerStatusResponse }> {
	const token = getAuthToken();
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (token) headers["Authorization"] = `Bearer ${token}`;

	const res = await fetch("/api/v1/pro/smart-power/config", {
		method: "POST",
		headers,
		body: JSON.stringify(config),
	});
	const data = await res.json();
	if (!res.ok) {
		throw new Error(
			data.detail || "Failed to update Smart Power configuration",
		);
	}
	return data;
}

export async function updatePrinterSmartPowerConfig(
	printerId: number,
	config: {
		enabled?: boolean;
		idle_minutes?: number;
		smart_plug_id?: number;
	},
): Promise<{ success: boolean; message: string }> {
	const token = getAuthToken();
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (token) headers["Authorization"] = `Bearer ${token}`;

	const res = await fetch(
		`/api/v1/pro/printers/${printerId}/smart-power/config`,
		{
			method: "POST",
			headers,
			body: JSON.stringify(config),
		},
	);
	const data = await res.json();
	if (!res.ok) {
		throw new Error(
			data.detail || "Failed to update printer Smart Power configuration",
		);
	}
	return data;
}

export async function triggerPrinterPowerOff(printerId: number): Promise<any> {
	const token = getAuthToken();
	const headers: Record<string, string> = {};
	if (token) headers["Authorization"] = `Bearer ${token}`;

	const res = await fetch(
		`/api/v1/pro/printers/${printerId}/smart-power/power-off`,
		{
			method: "POST",
			headers,
		},
	);
	const data = await res.json();
	if (!res.ok) {
		throw new Error(data.detail || "Failed to trigger power off");
	}
	return data;
}

export async function triggerPrinterPowerOn(printerId: number): Promise<any> {
	const token = getAuthToken();
	const headers: Record<string, string> = {};
	if (token) headers["Authorization"] = `Bearer ${token}`;

	const res = await fetch(
		`/api/v1/pro/printers/${printerId}/smart-power/power-on`,
		{
			method: "POST",
			headers,
		},
	);
	const data = await res.json();
	if (!res.ok) {
		throw new Error(data.detail || "Failed to trigger power on");
	}
	return data;
}
