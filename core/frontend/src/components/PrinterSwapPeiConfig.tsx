import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Save, Send } from "lucide-react";
import { Button } from "./Button";
import { useToast } from "../contexts/ToastContext";
import {
	api,
	type Printer as ClientPrinter,
	type PrinterStatus,
} from "../api/client";
import { ProBadge } from "./ProBadge";

export interface PrinterSwapPeiConfigProps {
	printer: ClientPrinter;
	onSave: (autoSwap: boolean, gcode: string) => void;
	isSaving: boolean;
}

export const BAMBU_A1_DEFAULT_GCODE = `;Move up until reach the Z limitation
G91;
G380 S3 Z-20 F1200
G380 S2 Z75 F1200
G380 S3 Z-20 F1200
G380 S2 Z75 F1200
G380 S3 Z-20 F1200
G380 S2 Z75 F1200
;Wait 1s
G4 P1000
;Changing plate
G380 S3 Z-20 F1200
G1 Z5 F1200
G90;
G28 Y;
G90;
G1 Y266 F2000;
G4 P1000
G91;
G380 S2 Z30 F1200
G90;
M211 Y0 Z0 ;
G91;
G90;
G1 Y50 F1000
G1 Y0 F2500
G91;
G380 S3 Z-20 F1200
G90;
G1 Y140 F2000
G1 Y30 F2000
G1 Y266 F2000
G1 Y0 F5000
G1 Y150 F2000
;Move Z down to 150mm to avoid homing fail
G91
G1 Z-150 F1200
;Push out the previous plate out of printer
G90
G1 Y266 F7000
G1 Y0 F5000
G1 Y150 F2000
G90
;Go Home
G28`;

export const isBambuA1 = (model?: string | null): boolean => {
	if (!model) return false;
	const m = model.trim().toUpperCase().replace(/[\s-]/g, "");
	if (m.includes("MINI") || m === "A12" || m === "N1" || m === "A04")
		return false;
	return (
		m.includes("A1") ||
		["A1", "BAMBULABA1", "BAMBUA1", "N2S", "A11"].includes(m)
	);
};

export const isSupportedSwapPeiPrinter = (model?: string | null): boolean => {
	// Currently hardcoded support for Bambu Lab A1
	// In the future: expand with A1 Mini, A2L, etc.
	return isBambuA1(model);
};

export function PrinterSwapPeiConfig({
	printer,
	onSave,
	isSaving,
}: PrinterSwapPeiConfigProps) {
	const [localAutoSwap, setLocalAutoSwap] = useState(
		printer.auto_swap || false,
	);
	const [isTesting, setIsTesting] = useState(false);

	const { showToast } = useToast();
	const { t } = useTranslation();

	// Fetch real-time printer status
	const { data: status } = useQuery<PrinterStatus>({
		queryKey: ["printerStatus", printer.id],
		queryFn: () => api.getPrinterStatus(printer.id),
		refetchInterval: 5000,
	});

	const canSwap =
		status?.connected &&
		(status?.state === "IDLE" ||
			status?.state === "FINISH" ||
			status?.state === "FAILED");

	useEffect(() => {
		setLocalAutoSwap(printer.auto_swap || false);
	}, [printer]);

	const hasChanged = localAutoSwap !== (printer.auto_swap || false);

	const handleTestSwap = async () => {
		setIsTesting(true);
		try {
			const res = await api.swapPei(printer.id);
			showToast(
				res.message ||
					t(
						"printers.toast.swapPeiTriggered",
						"Swap PEI macro triggered successfully",
					),
				"success",
			);
		} catch (err) {
			const msg =
				err instanceof Error
					? err.message
					: "Failed to trigger test swap";
			showToast(msg, "error");
		} finally {
			setIsTesting(false);
		}
	};

	return (
		<div className="p-4 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg space-y-3">
			<div className="flex justify-between items-center">
				<div>
					<span className="text-sm font-semibold text-white">
						{printer.name}
					</span>
					<span className="text-xs text-bambu-gray ml-2">
						({printer.model || "Unknown Model"})
					</span>
				</div>
			</div>

			<div className="flex items-center justify-between">
				<label
					htmlFor={`auto_swap_${printer.id}`}
					className="text-xs text-bambu-gray cursor-pointer select-none flex items-center gap-2"
				>
					<span>Enable Auto Swap PEI option for this printer</span>
					<ProBadge feature="Auto Swap PEI" />
				</label>
				<label className="relative inline-flex items-center cursor-pointer">
					<input
						type="checkbox"
						id={`auto_swap_${printer.id}`}
						checked={localAutoSwap}
						onChange={(e) => setLocalAutoSwap(e.target.checked)}
						className="sr-only peer"
					/>
					<div className="w-11 h-6 bg-bambu-dark-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bambu-green"></div>
				</label>
			</div>

			<div className="flex justify-end gap-2">
				<Button
					size="sm"
					variant="secondary"
					disabled={isTesting || isSaving || hasChanged || !canSwap}
					onClick={handleTestSwap}
					title={
						hasChanged
							? "Save changes before testing the macro"
							: !canSwap
								? "Printer is busy or disconnected"
								: "Test the Swap PEI macro on this printer"
					}
				>
					{isTesting ? (
						<Loader2 className="w-3 h-3 animate-spin mr-1" />
					) : (
						<Send className="w-3 h-3 mr-1" />
					)}
					Test Swap PEI
				</Button>
				<Button
					size="sm"
					disabled={!hasChanged || isSaving || isTesting}
					onClick={() =>
						onSave(localAutoSwap, BAMBU_A1_DEFAULT_GCODE)
					}
				>
					{isSaving ? (
						<Loader2 className="w-3 h-3 animate-spin mr-1" />
					) : (
						<Save className="w-3 h-3 mr-1" />
					)}
					Save Changes
				</Button>
			</div>
		</div>
	);
}
