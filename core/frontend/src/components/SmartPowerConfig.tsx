import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
	Zap,
	Power,
	Clock,
	ShieldCheck,
	RotateCw,
	Loader2,
	Leaf,
} from "lucide-react";
import { Button } from "./Button";
import { Card, CardContent, CardHeader } from "./Card";
import { ProBadge } from "./ProBadge";
import { useProLicense } from "../contexts/ProLicenseContext";
import { useToast } from "../contexts/ToastContext";
import { type Printer, type SmartPlug } from "../api/client";
import {
	fetchSmartPowerStatus,
	updateSmartPowerGlobalConfig,
	updatePrinterSmartPowerConfig,
	triggerPrinterPowerOff,
	triggerPrinterPowerOn,
	type SmartPowerStatusResponse,
} from "../api/beePro";

interface SmartPowerConfigProps {
	printers: Printer[];
	smartPlugs: SmartPlug[];
}

export function SmartPowerConfig({
	printers,
	smartPlugs,
}: SmartPowerConfigProps) {
	const { t } = useTranslation();
	const { isPro, openUpgradeModal } = useProLicense();
	const { showToast } = useToast();
	const queryClient = useQueryClient();

	const [globalEnabled, setGlobalEnabled] = useState(true);
	const [idleMinutes, setIdleMinutes] = useState(30);
	const [prewakeMinutes, setPrewakeMinutes] = useState(3);
	const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

	// Query Smart Power telemetry
	const { data: spStatus, refetch } = useQuery<SmartPowerStatusResponse>({
		queryKey: ["proSmartPowerStatus"],
		queryFn: fetchSmartPowerStatus,
		enabled: isPro,
		refetchInterval: 10000,
	});

	useEffect(() => {
		if (spStatus) {
			setGlobalEnabled(spStatus.enabled);
			setIdleMinutes(spStatus.idle_auto_off_minutes);
			setPrewakeMinutes(spStatus.prewake_minutes);
		}
	}, [spStatus]);

	// Global Config Mutation
	const globalMutation = useMutation({
		mutationFn: updateSmartPowerGlobalConfig,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["proSmartPowerStatus"],
			});
			showToast(
				t(
					"settings.smartPower.saveSuccess",
					"Smart Power settings saved successfully!",
				),
				"success",
			);
		},
		onError: (err: any) => {
			showToast(err.message || "Failed to save settings", "error");
		},
	});

	const handleSaveGlobal = (e: React.FormEvent) => {
		e.preventDefault();
		if (!isPro) {
			openUpgradeModal("Smart Power");
			return;
		}
		globalMutation.mutate({
			enabled: globalEnabled,
			idle_auto_off_minutes: Number(idleMinutes) || 30,
			prewake_minutes: Number(prewakeMinutes) || 3,
		});
	};

	const handleTogglePrinter = async (
		printerId: number,
		currentlyEnabled: boolean,
	) => {
		if (!isPro) {
			openUpgradeModal("Smart Power");
			return;
		}
		try {
			await updatePrinterSmartPowerConfig(printerId, {
				enabled: !currentlyEnabled,
			});
			refetch();
			showToast("Updated printer configuration", "success");
		} catch (err: any) {
			showToast(
				err.message || "Failed to update printer config",
				"error",
			);
		}
	};

	const handlePowerAction = async (
		printerId: number,
		action: "on" | "off",
	) => {
		if (!isPro) {
			openUpgradeModal("Smart Power");
			return;
		}
		setActionLoadingId(printerId);
		try {
			if (action === "on") {
				await triggerPrinterPowerOn(printerId);
				showToast(
					t(
						"printers.toast.powerOnSuccess",
						"Turned ON printer power successfully",
					),
					"success",
				);
			} else {
				await triggerPrinterPowerOff(printerId);
				showToast(
					t(
						"printers.toast.powerOffSuccess",
						"Turned OFF printer power successfully",
					),
					"success",
				);
			}
			refetch();
		} catch (err: any) {
			showToast(
				err.message || `Failed to turn ${action} printer power`,
				"error",
			);
		} finally {
			setActionLoadingId(null);
		}
	};

	// Find linked smart plug for a printer
	const getLinkedPlug = (printerId: number) => {
		if (spStatus?.printer_plug_map?.[printerId]) {
			const mappedId = spStatus.printer_plug_map[printerId];
			return smartPlugs.find((p) => p.id === mappedId);
		}
		return smartPlugs.find((p) => p.printer_id === printerId && p.enabled);
	};

	return (
		<div className="space-y-6">
			{/* Header Banner */}
			<div className="rounded-xl border border-bambu-dark-tertiary bg-gradient-to-r from-emerald-950/40 via-bambu-dark-secondary to-bambu-dark-secondary p-5 shadow-lg">
				<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<Leaf className="h-6 w-6 text-emerald-400" />
							<h2 className="text-lg font-bold text-white flex items-center gap-2">
								{t(
									"settings.smartPower.title",
									"Smart Power & Auto Energy Saver",
								)}
								<ProBadge feature="Smart Power" />
							</h2>
						</div>
						<p className="text-xs text-bambu-gray max-w-2xl leading-relaxed">
							{t(
								"settings.smartPower.description",
								"Automatically shuts down idle printers after jobs complete. Automatically powers on 3 minutes before scheduled queue prints. Prevents electrical hazards and minimizes energy costs.",
							)}
						</p>
					</div>

					{!isPro && (
						<Button
							variant="primary"
							className="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold hover:from-amber-400 hover:to-orange-400 shrink-0"
							onClick={() => openUpgradeModal("Smart Power")}
						>
							<Zap className="w-4 h-4 mr-1.5 fill-black" />
							{t(
								"settings.smartPower.unlockPro",
								"Upgrade to Unlock Pro",
							)}
						</Button>
					)}
				</div>
			</div>

			{/* Global Configuration Card */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-semibold text-white flex items-center gap-2">
							<Power className="w-4 h-4 text-emerald-400" />
							{t(
								"settings.smartPower.globalSettings",
								"Fleet Auto Power Configuration",
							)}
						</h3>
						{spStatus?.running && (
							<span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
								<span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
								Engine Active
							</span>
						)}
					</div>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSaveGlobal} className="space-y-4">
						<div className="flex items-center justify-between py-2 border-b border-bambu-dark-tertiary/50">
							<div>
								<label className="text-sm font-medium text-white block">
									{t(
										"settings.smartPower.enableGlobal",
										"Enable Smart Power Engine",
									)}
								</label>
								<p className="text-xs text-bambu-gray">
									{t(
										"settings.smartPower.enableGlobalDesc",
										"Enable idle monitoring and automatic shutdown via smart plugs.",
									)}
								</p>
							</div>
							<label className="relative inline-flex items-center cursor-pointer">
								<input
									type="checkbox"
									checked={globalEnabled}
									onChange={(e) =>
										setGlobalEnabled(e.target.checked)
									}
									disabled={!isPro}
									className="sr-only peer"
								/>
								<div className="w-11 h-6 bg-bambu-dark-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
							</label>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
							<div className="space-y-1.5">
								<label className="text-xs font-medium text-bambu-gray flex items-center gap-1.5">
									<Clock className="w-3.5 h-3.5 text-emerald-400" />
									{t(
										"settings.smartPower.idleTimeout",
										"Idle timeout before shutdown (minutes)",
									)}
								</label>
								<input
									type="number"
									min="1"
									max="1440"
									value={idleMinutes}
									onChange={(e) =>
										setIdleMinutes(Number(e.target.value))
									}
									disabled={!isPro || !globalEnabled}
									className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none disabled:opacity-50"
								/>
								<p className="text-[11px] text-bambu-gray">
									{t(
										"settings.smartPower.idleTimeoutHint",
										"Default: 30 minutes. The printer will not power off if jobs are queued or AMS drying is in progress.",
									)}
								</p>
							</div>

							<div className="space-y-1.5">
								<label className="text-xs font-medium text-bambu-gray flex items-center gap-1.5">
									<Zap className="w-3.5 h-3.5 text-amber-400" />
									{t(
										"settings.smartPower.prewakeTime",
										"Pre-wake power on before scheduled print (minutes)",
									)}
								</label>
								<input
									type="number"
									min="0"
									max="60"
									value={prewakeMinutes}
									onChange={(e) =>
										setPrewakeMinutes(
											Number(e.target.value),
										)
									}
									disabled={!isPro || !globalEnabled}
									className="w-full px-3 py-2 bg-bambu-dark border border-bambu-dark-tertiary rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none disabled:opacity-50"
								/>
								<p className="text-[11px] text-bambu-gray">
									{t(
										"settings.smartPower.prewakeTimeHint",
										"Default: 3 minutes. Powers on the printer ahead of time to reconnect Wi-Fi and preheat.",
									)}
								</p>
							</div>
						</div>

						<div className="flex justify-end pt-3">
							<Button
								type="submit"
								variant="primary"
								disabled={!isPro || globalMutation.isPending}
								className="bg-emerald-600 hover:bg-emerald-500 text-white"
							>
								{globalMutation.isPending ? (
									<Loader2 className="w-4 h-4 animate-spin mr-1.5" />
								) : null}
								{t("common.save", "Save Settings")}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>

			{/* Fleet Monitoring & Control */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-semibold text-white flex items-center gap-2">
							<ShieldCheck className="w-4 h-4 text-emerald-400" />
							{t(
								"settings.smartPower.fleetStatus",
								"Printer Fleet Status",
							)}
						</h3>
						{isPro && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => refetch()}
								className="text-xs text-bambu-gray hover:text-white"
							>
								<RotateCw className="w-3.5 h-3.5 mr-1" />
								{t("common.refresh", "Refresh")}
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{printers.length === 0 ? (
						<p className="text-xs text-bambu-gray italic py-4">
							{t(
								"settings.smartPower.noPrinters",
								"No printers configured in the system.",
							)}
						</p>
					) : (
						<div className="divide-y divide-bambu-dark-tertiary/40">
							{printers.map((printer) => {
								const plug = getLinkedPlug(printer.id);
								const idleInfo =
									spStatus?.tracked_idle_printers?.[
										printer.id
									];
								const printerCfg =
									spStatus?.printer_configs?.[printer.id];
								const isPrinterEnabled =
									printerCfg?.enabled !== false;
								const isPowerActionPending =
									actionLoadingId === printer.id;

								return (
									<div
										key={printer.id}
										className="py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
									>
										<div className="space-y-1">
											<div className="flex items-center gap-2">
												<span className="text-sm font-medium text-white">
													{printer.name}
												</span>
												<span className="text-xs text-bambu-gray">
													(
													{printer.model ||
														"Bambu Lab"}
													)
												</span>
												{isPrinterEnabled ? (
													<span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
														Auto-Off ON
													</span>
												) : (
													<span className="text-[10px] text-bambu-gray bg-bambu-dark-tertiary px-1.5 py-0.2 rounded">
														Disabled
													</span>
												)}
											</div>

											<div className="flex flex-wrap items-center gap-3 text-xs text-bambu-gray">
												<span>
													{t(
														"settings.smartPower.linkedPlug",
														"Linked Plug",
													)}
													:{" "}
													{plug ? (
														<span className="text-white font-medium">
															{plug.name} (
															{plug.plug_type.toUpperCase()}
															)
														</span>
													) : (
														<span className="text-amber-400 italic">
															{t(
																"settings.smartPower.noPlugAssigned",
																"No Smart Plug linked",
															)}
														</span>
													)}
												</span>

												{idleInfo && (
													<span className="text-amber-300 flex items-center gap-1 font-mono">
														<Clock className="w-3 h-3" />
														{t(
															"settings.smartPower.idleStatus",
															"Idle",
														)}
														:{" "}
														{idleInfo.idle_minutes}{" "}
														{t(
															"common.minutesShort",
															"min",
														)}
													</span>
												)}
											</div>
										</div>

										<div className="flex items-center gap-2 w-full md:w-auto justify-end">
											{plug && (
												<>
													<Button
														variant="secondary"
														size="sm"
														disabled={
															!isPro ||
															isPowerActionPending
														}
														onClick={() =>
															handlePowerAction(
																printer.id,
																"on",
															)
														}
														className="text-xs bg-emerald-950/40 text-emerald-300 border-emerald-800/40 hover:bg-emerald-900/60"
													>
														{isPowerActionPending ? (
															<Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
														) : (
															<Zap className="w-3.5 h-3.5 mr-1 text-emerald-400" />
														)}
														{t(
															"settings.smartPower.powerOn",
															"Power On",
														)}
													</Button>

													<Button
														variant="secondary"
														size="sm"
														disabled={
															!isPro ||
															isPowerActionPending
														}
														onClick={() =>
															handlePowerAction(
																printer.id,
																"off",
															)
														}
														className="text-xs bg-red-950/40 text-red-300 border-red-800/40 hover:bg-red-900/60"
													>
														{isPowerActionPending ? (
															<Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
														) : (
															<Power className="w-3.5 h-3.5 mr-1 text-red-400" />
														)}
														{t(
															"settings.smartPower.powerOff",
															"Power Off",
														)}
													</Button>
												</>
											)}

											<Button
												variant="ghost"
												size="sm"
												disabled={!isPro}
												onClick={() =>
													handleTogglePrinter(
														printer.id,
														isPrinterEnabled,
													)
												}
												className="text-xs text-bambu-gray hover:text-white"
											>
												{isPrinterEnabled
													? t(
															"settings.smartPower.disablePrinter",
															"Disable Smart Power",
														)
													: t(
															"settings.smartPower.enablePrinter",
															"Enable Smart Power",
														)}
											</Button>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
