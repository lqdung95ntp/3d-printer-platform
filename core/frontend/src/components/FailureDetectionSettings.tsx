import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ScanEye, Check, X, AlertTriangle, Info } from "lucide-react";
import { api } from "../api/client";
import { Card, CardContent, CardHeader } from "./Card";
import { Button } from "./Button";
import { Toggle } from "./Toggle";
import { useToast } from "../contexts/ToastContext";

type TestResult = { ok: boolean; message: string } | null;

export function FailureDetectionSettings() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { showToast } = useToast();

	const [enabled, setEnabled] = useState(false);
	const [provider, setProvider] = useState<"obico" | "octoeverywhere">(
		"obico",
	);
	const [mlUrl, setMlUrl] = useState("");
	const [sensitivity, setSensitivity] = useState<"low" | "medium" | "high">(
		"medium",
	);
	const [action, setAction] = useState<"notify" | "pause" | "pause_and_off">(
		"notify",
	);
	const [pollInterval, setPollInterval] = useState(10);
	const [octoKey, setOctoKey] = useState("");
	const [octoConfidence, setOctoConfidence] = useState<
		"lowest" | "low" | "medium" | "high" | "highest"
	>("medium");
	const [octoAction, setOctoAction] = useState<
		"notify" | "pause" | "pause_and_off"
	>("notify");
	const [octoInterval, setOctoInterval] = useState(15);
	const [enabledPrinters, setEnabledPrinters] = useState<number[] | null>(
		null,
	); // null = all
	const [testResult, setTestResult] = useState<TestResult>(null);
	const [initialized, setInitialized] = useState(false);

	const { data: settings } = useQuery({
		queryKey: ["settings"],
		queryFn: api.getSettings,
	});

	const { data: status, refetch: refetchStatus } = useQuery({
		queryKey: ["obico-status"],
		queryFn: api.getObicoStatus,
		refetchInterval: 10000,
	});

	const { data: printers } = useQuery({
		queryKey: ["printers"],
		queryFn: api.getPrinters,
	});

	useEffect(() => {
		if (!settings) return;
		setEnabled(settings.obico_enabled ?? false);
		setProvider(settings.ai_detection_provider ?? "obico");
		setMlUrl(settings.obico_ml_url ?? "");
		setSensitivity(settings.obico_sensitivity ?? "medium");
		setAction(settings.obico_action ?? "notify");
		setPollInterval(settings.obico_poll_interval ?? 10);
		setOctoKey(settings.octoeverywhere_api_key ?? "");
		setOctoConfidence(settings.octoeverywhere_confidence ?? "medium");
		setOctoAction(settings.octoeverywhere_action ?? "notify");
		setOctoInterval(settings.octoeverywhere_interval ?? 15);
		try {
			const list = settings.obico_enabled_printers
				? (JSON.parse(settings.obico_enabled_printers) as number[])
				: null;
			setEnabledPrinters(Array.isArray(list) ? list : null);
		} catch {
			setEnabledPrinters(null);
		}
		setInitialized(true);
	}, [settings]);

	const saveMutation = useMutation({
		mutationFn: () =>
			api.updateSettings({
				obico_enabled: enabled,
				ai_detection_provider: provider,
				obico_ml_url: mlUrl,
				obico_sensitivity: sensitivity,
				obico_action: action,
				obico_poll_interval: pollInterval,
				octoeverywhere_api_key: octoKey,
				octoeverywhere_confidence: octoConfidence,
				octoeverywhere_action: octoAction,
				octoeverywhere_interval: octoInterval,
				obico_enabled_printers:
					enabledPrinters === null
						? ""
						: JSON.stringify(enabledPrinters),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["settings"] });
			queryClient.invalidateQueries({ queryKey: ["obico-status"] });
			showToast(t("settings.toast.settingsSaved"));
		},
	});

	// Auto-save on change (debounced)
	useEffect(() => {
		if (!initialized || !settings) return;
		const changed =
			settings.obico_enabled !== enabled ||
			settings.ai_detection_provider !== provider ||
			settings.obico_ml_url !== mlUrl ||
			settings.obico_sensitivity !== sensitivity ||
			settings.obico_action !== action ||
			settings.obico_poll_interval !== pollInterval ||
			settings.octoeverywhere_api_key !== octoKey ||
			settings.octoeverywhere_confidence !== octoConfidence ||
			settings.octoeverywhere_action !== octoAction ||
			settings.octoeverywhere_interval !== octoInterval ||
			settings.obico_enabled_printers !==
				(enabledPrinters === null
					? ""
					: JSON.stringify(enabledPrinters));
		if (!changed) return;
		const id = setTimeout(() => saveMutation.mutate(), 500);
		return () => clearTimeout(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		enabled,
		provider,
		mlUrl,
		sensitivity,
		action,
		pollInterval,
		octoKey,
		octoConfidence,
		octoAction,
		octoInterval,
		enabledPrinters,
		initialized,
	]);

	const handleTest = async () => {
		setTestResult(null);
		try {
			if (provider === "octoeverywhere") {
				const res = await api.testOctoEverywhereKey(octoKey);
				if (res.ok) {
					setTestResult({
						ok: true,
						message:
							res.message || "OctoEverywhere API key is valid!",
					});
				} else {
					setTestResult({
						ok: false,
						message:
							res.error ||
							"OctoEverywhere key verification failed",
					});
				}
			} else {
				const res = await api.testObicoConnection(mlUrl);
				if (res.ok) {
					setTestResult({
						ok: true,
						message: t("failureDetection.testSuccess"),
					});
				} else {
					setTestResult({
						ok: false,
						message:
							res.error ||
							`HTTP ${res.status_code ?? "?"} — ${res.body ?? t("failureDetection.testFailed")}`,
					});
				}
			}
		} catch (e: unknown) {
			setTestResult({
				ok: false,
				message: e instanceof Error ? e.message : String(e),
			});
		}
	};

	const togglePrinter = (printerId: number, checked: boolean) => {
		if (enabledPrinters === null) {
			// switch from "all" to an explicit list
			const allIds = printers?.map((p) => p.id) ?? [];
			const next = checked
				? allIds
				: allIds.filter((id) => id !== printerId);
			setEnabledPrinters(next);
			return;
		}
		if (checked) {
			setEnabledPrinters([...enabledPrinters, printerId]);
		} else {
			setEnabledPrinters(
				enabledPrinters.filter((id) => id !== printerId),
			);
		}
	};

	return (
		<div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
			<div className="space-y-3 flex-1 lg:max-w-xl">
				<Card id="card-fd-ml">
					<CardHeader>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<ScanEye className="w-5 h-5 text-bambu-green" />
								<h2 className="text-lg font-semibold text-white">
									{t("failureDetection.title")}
								</h2>
							</div>
							<Toggle checked={enabled} onChange={setEnabled} />
						</div>
						<p className="text-sm text-bambu-gray mt-2">
							{t("failureDetection.description")}
						</p>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<label className="block text-sm text-bambu-gray mb-1">
								{t(
									"failureDetection.provider",
									"Failure Detection Provider",
								)}
							</label>
							<select
								value={provider}
								onChange={(e) => {
									setProvider(
										e.target.value as
											| "obico"
											| "octoeverywhere",
									);
									setTestResult(null);
								}}
								disabled={!enabled}
								className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
							>
								<option value="obico">
									Obico (Self-hosted ML API)
								</option>
								<option value="octoeverywhere">
									OctoEverywhere (Cloud AI — Free Gadget Key)
								</option>
							</select>
						</div>

						{provider === "octoeverywhere" ? (
							<>
								<div>
									<label className="block text-sm text-bambu-gray mb-1">
										OctoEverywhere Gadget API Key
									</label>
									<div className="flex gap-2">
										<input
											type="password"
											value={octoKey}
											onChange={(e) =>
												setOctoKey(e.target.value)
											}
											placeholder="oe_gadget_..."
											className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono"
											disabled={!enabled}
										/>
										<Button
											onClick={handleTest}
											disabled={
												!octoKey ||
												saveMutation.isPending
											}
											variant="secondary"
										>
											{t("failureDetection.test")}
										</Button>
									</div>
									<p className="text-xs text-bambu-gray mt-1">
										Get a free Gadget API key from{" "}
										<a
											href="https://octoeverywhere.com/gadget"
											target="_blank"
											rel="noopener noreferrer"
											className="text-bambu-green hover:underline"
										>
											octoeverywhere.com/gadget
										</a>
									</p>
									{testResult && (
										<div
											className={`flex items-start gap-2 mt-2 text-sm ${
												testResult.ok
													? "text-green-400"
													: "text-red-400"
											}`}
										>
											{testResult.ok ? (
												<Check className="w-4 h-4 mt-0.5" />
											) : (
												<X className="w-4 h-4 mt-0.5" />
											)}
											<span>{testResult.message}</span>
										</div>
									)}
								</div>

								<div>
									<label className="block text-sm text-bambu-gray mb-1">
										Confidence
									</label>
									<select
										value={octoConfidence}
										onChange={(e) =>
											setOctoConfidence(
												e.target.value as any,
											)
										}
										disabled={!enabled}
										className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
									>
										<option value="lowest">
											Lowest (Earlier alerts, higher
											false-alarm chance)
										</option>
										<option value="low">Low</option>
										<option value="medium">
											Medium (Recommended)
										</option>
										<option value="high">High</option>
										<option value="highest">
											Highest (Only severe/clear failures)
										</option>
									</select>
								</div>

								<div>
									<label className="block text-sm text-bambu-gray mb-1">
										{t("failureDetection.action")}
									</label>
									<select
										value={octoAction}
										onChange={(e) =>
											setOctoAction(e.target.value as any)
										}
										disabled={!enabled}
										className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
									>
										<option value="notify">
											{t("failureDetection.actionNotify")}
										</option>
										<option value="pause">
											{t("failureDetection.actionPause")}
										</option>
										<option value="pause_and_off">
											{t(
												"failureDetection.actionPauseOff",
											)}
										</option>
									</select>
								</div>

								<div>
									<label className="block text-sm text-bambu-gray mb-1">
										Inspection Interval (seconds)
									</label>
									<input
										type="number"
										value={octoInterval}
										onChange={(e) =>
											setOctoInterval(
												Math.max(
													5,
													Math.min(
														120,
														Number(
															e.target.value,
														) || 15,
													),
												),
											)
										}
										min={5}
										max={120}
										disabled={!enabled}
										className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
									/>
									<p className="text-xs text-bambu-gray mt-1">
										Recommended: 15 seconds. Range: 5 to 120
										seconds.
									</p>
								</div>
							</>
						) : (
							<>
								<div>
									<label className="block text-sm text-bambu-gray mb-1">
										{t("failureDetection.mlUrl")}
									</label>
									<div className="flex gap-2">
										<input
											type="text"
											value={mlUrl}
											onChange={(e) =>
												setMlUrl(e.target.value)
											}
											placeholder="http://192.168.1.10:3333"
											className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
											disabled={!enabled}
										/>
										<Button
											onClick={handleTest}
											disabled={
												!mlUrl || saveMutation.isPending
											}
											variant="secondary"
										>
											{t("failureDetection.test")}
										</Button>
									</div>
									<p className="text-xs text-bambu-gray mt-1">
										{t("failureDetection.mlUrlHint")}
									</p>
									{testResult && (
										<div
											className={`flex items-start gap-2 mt-2 text-sm ${
												testResult.ok
													? "text-green-400"
													: "text-red-400"
											}`}
										>
											{testResult.ok ? (
												<Check className="w-4 h-4 mt-0.5" />
											) : (
												<X className="w-4 h-4 mt-0.5" />
											)}
											<span>{testResult.message}</span>
										</div>
									)}
								</div>

								<div>
									<label className="block text-sm text-bambu-gray mb-1">
										{t("failureDetection.sensitivity")}
									</label>
									<select
										value={sensitivity}
										onChange={(e) =>
											setSensitivity(
												e.target.value as
													| "low"
													| "medium"
													| "high",
											)
										}
										disabled={!enabled}
										className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
									>
										<option value="low">
											{t(
												"failureDetection.sensitivityLow",
											)}
										</option>
										<option value="medium">
											{t(
												"failureDetection.sensitivityMedium",
											)}
										</option>
										<option value="high">
											{t(
												"failureDetection.sensitivityHigh",
											)}
										</option>
									</select>
									<p className="text-xs text-bambu-gray mt-1">
										{t("failureDetection.sensitivityHint")}
									</p>
								</div>

								<div>
									<label className="block text-sm text-bambu-gray mb-1">
										{t("failureDetection.action")}
									</label>
									<select
										value={action}
										onChange={(e) =>
											setAction(
												e.target.value as
													| "notify"
													| "pause"
													| "pause_and_off",
											)
										}
										disabled={!enabled}
										className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
									>
										<option value="notify">
											{t("failureDetection.actionNotify")}
										</option>
										<option value="pause">
											{t("failureDetection.actionPause")}
										</option>
										<option value="pause_and_off">
											{t(
												"failureDetection.actionPauseOff",
											)}
										</option>
									</select>
								</div>

								<div>
									<label className="block text-sm text-bambu-gray mb-1">
										{t("failureDetection.pollInterval")}
									</label>
									<input
										type="number"
										value={pollInterval}
										onChange={(e) =>
											setPollInterval(
												Math.max(
													5,
													Math.min(
														120,
														Number(
															e.target.value,
														) || 10,
													),
												),
											)
										}
										min={5}
										max={120}
										disabled={!enabled}
										className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
									/>
									<p className="text-xs text-bambu-gray mt-1">
										{t("failureDetection.pollIntervalHint")}
									</p>
								</div>
							</>
						)}

						{status &&
							!status.external_url_configured &&
							enabled && (
								<div className="flex items-start gap-2 p-3 bg-amber-900/30 border border-amber-700 rounded text-sm text-amber-200">
									<AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
									<div>
										<div className="font-medium">
											{t(
												"failureDetection.externalUrlMissing",
											)}
										</div>
										<div className="text-xs mt-1">
											{t(
												"failureDetection.externalUrlHint",
											)}
										</div>
									</div>
								</div>
							)}
					</CardContent>
				</Card>

				<Card id="card-fd-perprinter">
					<CardHeader>
						<h2 className="text-lg font-semibold text-white">
							{t("failureDetection.perPrinterTitle")}
						</h2>
						<p className="text-sm text-bambu-gray mt-1">
							{t("failureDetection.perPrinterHint")}
						</p>
					</CardHeader>
					<CardContent className="space-y-2">
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={enabledPrinters === null}
								onChange={(e) =>
									setEnabledPrinters(
										e.target.checked
											? null
											: (printers?.map((p) => p.id) ??
													[]),
									)
								}
								disabled={!enabled}
							/>
							<span className="text-white">
								{t("failureDetection.monitorAll")}
							</span>
						</label>
						{enabledPrinters !== null && printers && (
							<div className="pl-5 space-y-1 border-l border-gray-700">
								{printers.map((p) => (
									<label
										key={p.id}
										className="flex items-center gap-2 text-sm"
									>
										<input
											type="checkbox"
											checked={enabledPrinters.includes(
												p.id,
											)}
											onChange={(e) =>
												togglePrinter(
													p.id,
													e.target.checked,
												)
											}
											disabled={!enabled}
										/>
										<span className="text-white">
											{p.name}
										</span>
									</label>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<div className="space-y-3 flex-1 lg:max-w-xl">
				<Card id="card-fd-status">
					<CardHeader>
						<h2 className="text-lg font-semibold text-white">
							{t("failureDetection.statusTitle")}
						</h2>
					</CardHeader>
					<CardContent>
						{!status ? (
							<div className="flex items-center gap-2 text-bambu-gray">
								<Loader2 className="w-4 h-4 animate-spin" />
								<span>{t("common.loading")}</span>
							</div>
						) : (
							<div className="space-y-3 text-sm">
								<div className="flex justify-between">
									<span className="text-bambu-gray">
										{t("failureDetection.serviceRunning")}
									</span>
									<span
										className={
											status.is_running
												? "text-green-400"
												: "text-red-400"
										}
									>
										{status.is_running
											? t("common.yes")
											: t("common.no")}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-bambu-gray">
										{t("failureDetection.thresholds")}
									</span>
									<span className="text-white font-mono">
										{status.thresholds.low.toFixed(2)} /{" "}
										{status.thresholds.high.toFixed(2)}
									</span>
								</div>
								{status.last_error && (
									<div className="flex items-start gap-2 text-red-400">
										<X className="w-4 h-4 mt-0.5 flex-shrink-0" />
										<span className="break-words">
											{status.last_error}
										</span>
									</div>
								)}
								<div>
									<div className="text-bambu-gray mb-1">
										{t("failureDetection.activePrinters")}
									</div>
									{Object.keys(status.per_printer).length ===
									0 ? (
										<div className="text-bambu-gray italic text-xs">
											{t(
												"failureDetection.noActivePrints",
											)}
										</div>
									) : (
										<div className="space-y-1">
											{Object.entries(
												status.per_printer,
											).map(([pid, info]) => {
												const printer = printers?.find(
													(p) => String(p.id) === pid,
												);
												const colorClass =
													info.class === "failure"
														? "text-red-400"
														: info.class ===
															  "warning"
															? "text-amber-400"
															: "text-green-400";
												return (
													<div
														key={pid}
														className="flex justify-between"
													>
														<span className="text-white">
															{printer?.name ??
																`Printer ${pid}`}
														</span>
														<span
															className={`font-mono ${colorClass}`}
														>
															{info.class} (
															{info.score.toFixed(
																3,
															)}
															, {info.frame_count}
															f)
														</span>
													</div>
												);
											})}
										</div>
									)}
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				<Card id="card-fd-history">
					<CardHeader>
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-semibold text-white">
								{t("failureDetection.historyTitle")}
							</h2>
							<button
								onClick={() => refetchStatus()}
								className="text-xs text-bambu-gray hover:text-white"
							>
								{t("common.refresh")}
							</button>
						</div>
					</CardHeader>
					<CardContent>
						{!status || status.history.length === 0 ? (
							<div className="flex items-center gap-2 text-bambu-gray text-sm">
								<Info className="w-4 h-4" />
								<span>{t("failureDetection.noHistory")}</span>
							</div>
						) : (
							<div className="space-y-1 max-h-96 overflow-y-auto text-xs font-mono">
								{status.history.map((ev, idx) => {
									const printer = printers?.find(
										(p) => p.id === ev.printer_id,
									);
									const colorClass =
										ev.class === "failure"
											? "text-red-400"
											: ev.class === "warning"
												? "text-amber-400"
												: "text-bambu-gray";
									return (
										<div
											key={idx}
											className="flex justify-between gap-2 py-1 border-b border-gray-800"
										>
											<span className="text-bambu-gray">
												{new Date(
													ev.timestamp,
												).toLocaleTimeString()}
											</span>
											<span className="text-white truncate">
												{printer?.name ??
													`#${ev.printer_id}`}
											</span>
											<span className={colorClass}>
												{ev.class} {ev.score.toFixed(3)}
											</span>
										</div>
									);
								})}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
