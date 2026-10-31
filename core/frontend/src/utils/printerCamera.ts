import type { Printer } from "../api/client";

export function isSnapmakerU1(model: string | null | undefined): boolean {
	const m = (model || "").toLowerCase().trim();
	return (m.includes("snapmaker") && m.includes("u1")) || m === "u1";
}

export function canOpenPrinterCamera(
	printer: Pick<
		Printer,
		"provider" | "external_camera_enabled" | "external_camera_url"
	> & { model?: string | null },
	isConnected: boolean | undefined,
	canViewCamera: boolean,
): boolean {
	if (!canViewCamera) return false;

	const hasExternalCamera = Boolean(
		printer.external_camera_enabled && printer.external_camera_url?.trim(),
	);
	if (hasExternalCamera) return true;

	// Elegoo SDCP Centauri Carbon exposes a native MJPEG stream on :3031/video.
	// The API normally derives this as an external-camera URL, but allow the
	// action for connected Elegoo printers even if a stale client object has not
	// received the derived fields yet.
	if (printer.provider === "elegoo_sdcp") return Boolean(isConnected);

	// Snapmaker U1 exposes a native camera snapshot stream via Moonraker + unisrv.
	if (isSnapmakerU1(printer.model)) return Boolean(isConnected);

	// Bambu printers have a native camera endpoint. Moonraker/Klipper API URLs
	// are control endpoints, not camera streams; those printers need the configured
	// Camera URL from add/edit settings so the normal Printbuddy camera viewer can
	// render it like Bambu camera windows do.
	return printer.provider === "bambu" && Boolean(isConnected);
}
