import { useState, useEffect } from "react";
import {
	X,
	Loader2,
	CheckCircle,
	AlertTriangle,
	Camera,
	RotateCcw,
	ArrowRight,
	ArrowLeft,
	Sparkles,
	Sun,
	Home,
	Check,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api, type Printer, type PlateDetectionResult } from "../api/client";
import { Button } from "./Button";

interface PeiCalibrationModalProps {
	printer: Printer;
	onClose: () => void;
	onSuccess?: (newRoi?: {
		x: number;
		y: number;
		w: number;
		h: number;
	}) => void;
	showToast: (message: string, type: "success" | "error" | "info") => void;
}

export function PeiCalibrationModal({
	printer,
	onClose,
	onSuccess,
	showToast,
}: PeiCalibrationModalProps) {
	const { t } = useTranslation();
	const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

	// Step 1 states: Homing & Chamber Light
	const [isPreparing, setIsPreparing] = useState(false);
	const [isPrepared, setIsPrepared] = useState(false);

	// Step 2 states: Capture snapshot & ROI selection
	const [confirmedNoPei, setConfirmedNoPei] = useState(false);
	const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
	const [snapshotBase64, setSnapshotBase64] = useState<string | null>(null);
	const [isCapturing, setIsCapturing] = useState(false);
	const [roi, setRoi] = useState<{
		x: number;
		y: number;
		w: number;
		h: number;
	}>({
		x: printer.plate_detection_roi?.x ?? 0.0,
		y: printer.plate_detection_roi?.y ?? 0.18,
		w: printer.plate_detection_roi?.w ?? 1.0,
		h: printer.plate_detection_roi?.h ?? 0.25,
	});

	// Step 3 states: Training & Verification
	const [isTraining, setIsTraining] = useState(false);
	const [trainResult, setTrainResult] = useState<{
		threshold: number;
		vectors_count: number;
		elapsed_ms: number;
	} | null>(null);

	const [isVerifying, setIsVerifying] = useState(false);
	const [verifyResult, setVerifyResult] =
		useState<PlateDetectionResult | null>(null);
	const [isResetting, setIsResetting] = useState(false);

	// Action: Prepare Printer (G28 + Light)
	const handlePrepare = async () => {
		setIsPreparing(true);
		try {
			await api.preparePlateDetection(printer.id);
			setIsPrepared(true);
			showToast(t("printers.peiCalib.printerReady"), "success");
		} catch (error) {
			showToast(
				error instanceof Error
					? error.message
					: "Failed to prepare printer",
				"error",
			);
		} finally {
			setIsPreparing(false);
		}
	};

	// Action: Capture Snapshot
	const handleCaptureSnapshot = async () => {
		setIsCapturing(true);
		try {
			const url = api.getCameraSnapshotUrl(printer.id);
			// Fetch blob and convert to data url for fast client-side ROI rendering and training upload
			const resp = await fetch(url);
			if (!resp.ok) {
				throw new Error(
					`Failed to fetch camera snapshot (${resp.status})`,
				);
			}
			const blob = await resp.blob();
			const reader = new FileReader();
			reader.onloadend = () => {
				const base64data = reader.result as string;
				setSnapshotBase64(base64data);
				setSnapshotUrl(base64data);
			};
			reader.readAsDataURL(blob);
		} catch (error) {
			showToast(
				error instanceof Error
					? error.message
					: "Failed to capture snapshot",
				"error",
			);
		} finally {
			setIsCapturing(false);
		}
	};

	// Auto-capture on entering Step 2 if not already captured
	useEffect(() => {
		if (currentStep === 2 && !snapshotUrl && !isCapturing) {
			handleCaptureSnapshot();
		}
	}, [currentStep]);

	// Action: Start AI Training
	const handleStartTraining = async () => {
		setCurrentStep(3);
		setIsTraining(true);
		setTrainResult(null);
		setVerifyResult(null);
		try {
			const res = await api.calibratePeiDetection(printer.id, {
				roi: [roi.x, roi.y, roi.w, roi.h],
				image_base64: snapshotBase64 ?? undefined,
			});
			setTrainResult({
				threshold: res.threshold,
				vectors_count: res.vectors_count,
				elapsed_ms: res.elapsed_ms,
			});
			showToast(t("printers.peiCalib.trainSuccess"), "success");
			onSuccess?.(roi);
		} catch (error) {
			showToast(
				error instanceof Error
					? error.message
					: "Failed to train PEI model",
				"error",
			);
		} finally {
			setIsTraining(false);
		}
	};

	// Action: Verify Detection
	const handleVerify = async () => {
		setIsVerifying(true);
		try {
			const result = await api.checkPlateEmpty(printer.id, {
				includeDebugImage: true,
				roi: roi,
			});
			setVerifyResult(result);
		} catch (error) {
			showToast(
				error instanceof Error
					? error.message
					: "Failed to verify detection",
				"error",
			);
		} finally {
			setIsVerifying(false);
		}
	};

	// Action: Reset Factory Model
	const handleResetFactory = async () => {
		if (!window.confirm(t("printers.peiCalib.resetFactoryConfirm"))) {
			return;
		}
		setIsResetting(true);
		try {
			await api.resetDefaultPeiDetection(printer.id);
			showToast(t("printers.peiCalib.resetSuccess"), "success");
			onClose();
		} catch (error) {
			showToast(
				error instanceof Error
					? error.message
					: "Failed to reset model",
				"error",
			);
		} finally {
			setIsResetting(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
			<div className="relative w-full max-w-2xl bg-bambu-dark-secondary rounded-xl border border-bambu-dark-tertiary shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-bambu-dark-tertiary">
					<div className="flex items-center gap-2">
						<h2 className="text-lg font-semibold text-white">
							{t("printers.peiCalib.modalTitle")}
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1 rounded-lg text-bambu-gray hover:text-white hover:bg-bambu-dark-tertiary transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Step Progress Bar */}
				<div className="px-6 py-3 bg-bambu-dark-tertiary/40 border-b border-bambu-dark-tertiary flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span
							className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
								currentStep === 1
									? "bg-bambu-green text-black"
									: currentStep > 1
										? "bg-bambu-green/20 text-bambu-green border border-bambu-green"
										: "bg-bambu-dark-tertiary text-bambu-gray"
							}`}
						>
							1
						</span>
						<span
							className={`text-xs font-medium ${
								currentStep === 1
									? "text-white"
									: "text-bambu-gray"
							}`}
						>
							{t("printers.peiCalib.step1")}
						</span>
					</div>

					<div className="flex-1 h-[2px] mx-3 bg-bambu-dark-tertiary" />

					<div className="flex items-center gap-2">
						<span
							className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
								currentStep === 2
									? "bg-bambu-green text-black"
									: currentStep > 2
										? "bg-bambu-green/20 text-bambu-green border border-bambu-green"
										: "bg-bambu-dark-tertiary text-bambu-gray"
							}`}
						>
							2
						</span>
						<span
							className={`text-xs font-medium ${
								currentStep === 2
									? "text-white"
									: "text-bambu-gray"
							}`}
						>
							{t("printers.peiCalib.step2")}
						</span>
					</div>

					<div className="flex-1 h-[2px] mx-3 bg-bambu-dark-tertiary" />

					<div className="flex items-center gap-2">
						<span
							className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
								currentStep === 3
									? "bg-bambu-green text-black"
									: "bg-bambu-dark-tertiary text-bambu-gray"
							}`}
						>
							3
						</span>
						<span
							className={`text-xs font-medium ${
								currentStep === 3
									? "text-white"
									: "text-bambu-gray"
							}`}
						>
							{t("printers.peiCalib.step3")}
						</span>
					</div>
				</div>

				{/* Body Content */}
				<div className="p-6 overflow-y-auto space-y-5 flex-1">
					{/* STEP 1: PREPARE */}
					{currentStep === 1 && (
						<div className="space-y-4">
							<div className="p-4 rounded-lg bg-bambu-dark-tertiary/40 border border-bambu-dark-tertiary flex items-start gap-3">
								<Home className="w-5 h-5 text-bambu-green flex-shrink-0 mt-0.5" />
								<div>
									<h4 className="text-sm font-semibold text-white">
										{t("printers.peiCalib.step1")}
									</h4>
									<p className="text-xs text-bambu-gray mt-1 leading-relaxed">
										{t("printers.peiCalib.step1Desc")}
									</p>
								</div>
							</div>

							<div className="flex flex-col items-center justify-center p-8 border border-dashed border-bambu-dark-tertiary rounded-xl bg-bambu-dark-tertiary/20 gap-4">
								<div className="flex items-center gap-4">
									<div className="flex items-center gap-2 text-sm text-bambu-gray">
										<Home className="w-4 h-4 text-bambu-green" />
										<span>G28 Auto-Home</span>
									</div>
									<div className="w-1.5 h-1.5 rounded-full bg-bambu-gray" />
									<div className="flex items-center gap-2 text-sm text-bambu-gray">
										<Sun className="w-4 h-4 text-yellow-400" />
										<span>Chamber Light ON</span>
									</div>
								</div>

								{isPrepared ? (
									<div className="flex items-center gap-2 text-sm text-bambu-green font-medium bg-bambu-green/10 border border-bambu-green/30 px-4 py-2 rounded-lg">
										<CheckCircle className="w-4 h-4" />
										<span>
											{t(
												"printers.peiCalib.printerReady",
											)}
										</span>
									</div>
								) : (
									<Button
										onClick={handlePrepare}
										disabled={isPreparing}
										className="w-full max-w-xs"
									>
										{isPreparing ? (
											<>
												<Loader2 className="w-4 h-4 mr-2 animate-spin" />
												{t(
													"printers.peiCalib.homingProgress",
												)}
											</>
										) : (
											<>
												<Sparkles className="w-4 h-4 mr-2" />
												{t(
													"printers.peiCalib.homeAndLightBtn",
												)}
											</>
										)}
									</Button>
								)}
							</div>
						</div>
					)}

					{/* STEP 2: CAPTURE & ROI */}
					{currentStep === 2 && (
						<div className="space-y-4">
							{/* Warning banner */}
							<div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-3">
								<AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
								<div className="space-y-2">
									<h4 className="text-sm font-semibold text-yellow-400">
										{t("printers.peiCalib.warningTitle")}
									</h4>
									<p className="text-xs text-bambu-gray leading-relaxed">
										{t("printers.peiCalib.warningText")}
									</p>
									<label className="flex items-center gap-2 cursor-pointer pt-1">
										<input
											type="checkbox"
											checked={confirmedNoPei}
											onChange={(e) =>
												setConfirmedNoPei(
													e.target.checked,
												)
											}
											className="w-4 h-4 rounded border-bambu-dark-tertiary bg-bambu-dark-primary text-bambu-green focus:ring-bambu-green accent-green-500"
										/>
										<span className="text-xs font-medium text-white">
											{t(
												"printers.peiCalib.confirmNoPei",
											)}
										</span>
									</label>
								</div>
							</div>

							{/* Capture snapshot button */}
							<div className="flex items-center justify-between">
								<p className="text-xs text-bambu-gray">
									{t("printers.peiCalib.roiInstruction")}
								</p>
								<Button
									size="sm"
									variant="secondary"
									onClick={handleCaptureSnapshot}
									disabled={isCapturing}
								>
									{isCapturing ? (
										<>
											<Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
											{t(
												"printers.peiCalib.capturingSnapshot",
											)}
										</>
									) : (
										<>
											<Camera className="w-3.5 h-3.5 mr-1.5" />
											{t(
												"printers.peiCalib.captureSnapshot",
											)}
										</>
									)}
								</Button>
							</div>

							{/* Image preview with interactive ROI overlay */}
							<div className="relative w-full min-h-[220px] bg-black rounded-lg overflow-hidden border border-bambu-dark-tertiary flex items-center justify-center">
								{snapshotUrl ? (
									<div className="relative w-full">
										<img
											src={snapshotUrl}
											alt="Bed Snapshot"
											className="w-full h-auto block"
										/>
										{/* ROI Box Overlay */}
										<div
											className="absolute border-2 border-bambu-green bg-bambu-green/20 pointer-events-none transition-all"
											style={{
												left: `${roi.x * 100}%`,
												top: `${roi.y * 100}%`,
												width: `${roi.w * 100}%`,
												height: `${roi.h * 100}%`,
											}}
										>
											<span className="absolute -top-5 left-0 px-1 py-0.5 text-[10px] font-semibold bg-bambu-green text-black rounded">
												ROI ({Math.round(roi.w * 100)}%
												× {Math.round(roi.h * 100)}%)
											</span>
										</div>
									</div>
								) : (
									<div className="text-center p-6 text-bambu-gray text-xs">
										{isCapturing ? (
											<div className="flex flex-col items-center gap-2">
												<Loader2 className="w-6 h-6 animate-spin text-bambu-green" />
												<span>
													{t(
														"printers.peiCalib.capturingSnapshot",
													)}
												</span>
											</div>
										) : (
											<span>
												{t(
													"printers.peiCalib.noSnapshotYet",
												)}
											</span>
										)}
									</div>
								)}
							</div>

							{/* ROI Sliders */}
							<div className="grid grid-cols-2 gap-4 bg-bambu-dark-tertiary/40 p-4 rounded-lg border border-bambu-dark-tertiary">
								<div>
									<div className="flex justify-between text-xs text-bambu-gray mb-1">
										<span>
											{t("printers.peiCalib.xStart")}
										</span>
										<span>{Math.round(roi.x * 100)}%</span>
									</div>
									<input
										type="range"
										min="0"
										max="0.9"
										step="0.01"
										value={roi.x}
										onChange={(e) =>
											setRoi({
												...roi,
												x: parseFloat(e.target.value),
											})
										}
										className="w-full h-1.5 bg-bambu-dark-tertiary rounded-lg cursor-pointer accent-green-500"
									/>
								</div>

								<div>
									<div className="flex justify-between text-xs text-bambu-gray mb-1">
										<span>
											{t("printers.peiCalib.yStart")}
										</span>
										<span>{Math.round(roi.y * 100)}%</span>
									</div>
									<input
										type="range"
										min="0"
										max="0.9"
										step="0.01"
										value={roi.y}
										onChange={(e) =>
											setRoi({
												...roi,
												y: parseFloat(e.target.value),
											})
										}
										className="w-full h-1.5 bg-bambu-dark-tertiary rounded-lg cursor-pointer accent-green-500"
									/>
								</div>

								<div>
									<div className="flex justify-between text-xs text-bambu-gray mb-1">
										<span>
											{t("printers.peiCalib.width")}
										</span>
										<span>{Math.round(roi.w * 100)}%</span>
									</div>
									<input
										type="range"
										min="0.1"
										max="1.0"
										step="0.01"
										value={roi.w}
										onChange={(e) =>
											setRoi({
												...roi,
												w: parseFloat(e.target.value),
											})
										}
										className="w-full h-1.5 bg-bambu-dark-tertiary rounded-lg cursor-pointer accent-green-500"
									/>
								</div>

								<div>
									<div className="flex justify-between text-xs text-bambu-gray mb-1">
										<span>
											{t("printers.peiCalib.height")}
										</span>
										<span>{Math.round(roi.h * 100)}%</span>
									</div>
									<input
										type="range"
										min="0.1"
										max="1.0"
										step="0.01"
										value={roi.h}
										onChange={(e) =>
											setRoi({
												...roi,
												h: parseFloat(e.target.value),
											})
										}
										className="w-full h-1.5 bg-bambu-dark-tertiary rounded-lg cursor-pointer accent-green-500"
									/>
								</div>
							</div>
						</div>
					)}

					{/* STEP 3: TRAIN & VERIFY */}
					{currentStep === 3 && (
						<div className="space-y-5">
							{isTraining ? (
								<div className="flex flex-col items-center justify-center p-10 gap-3">
									<Loader2 className="w-10 h-10 animate-spin text-bambu-green" />
									<p className="text-sm font-medium text-white">
										{t(
											"printers.peiCalib.trainingProgress",
										)}
									</p>
								</div>
							) : (
								<>
									{/* Training Result Card */}
									{trainResult && (
										<div className="p-4 rounded-xl bg-bambu-green/10 border border-bambu-green/30 space-y-3">
											<div className="flex items-center gap-2 text-bambu-green font-semibold text-sm">
												<CheckCircle className="w-5 h-5" />
												<span>
													{t(
														"printers.peiCalib.trainSuccess",
													)}
												</span>
											</div>
											<div className="grid grid-cols-3 gap-2 pt-1 text-center">
												<div className="p-2 rounded bg-bambu-dark-secondary/60">
													<div className="text-[11px] text-bambu-gray">
														{t(
															"printers.peiCalib.threshold",
														)}
													</div>
													<div className="text-sm font-bold text-white mt-0.5">
														{trainResult.threshold.toFixed(
															2,
														)}
													</div>
												</div>
												<div className="p-2 rounded bg-bambu-dark-secondary/60">
													<div className="text-[11px] text-bambu-gray">
														{t(
															"printers.peiCalib.vectorsCount",
														)}
													</div>
													<div className="text-sm font-bold text-white mt-0.5">
														{
															trainResult.vectors_count
														}
													</div>
												</div>
												<div className="p-2 rounded bg-bambu-dark-secondary/60">
													<div className="text-[11px] text-bambu-gray">
														{t(
															"printers.peiCalib.elapsedTime",
														)}
													</div>
													<div className="text-sm font-bold text-white mt-0.5">
														{trainResult.elapsed_ms}{" "}
														ms
													</div>
												</div>
											</div>
										</div>
									)}

									{/* Verification Section */}
									<div className="p-4 rounded-xl bg-bambu-dark-tertiary/40 border border-bambu-dark-tertiary space-y-3">
										<div className="flex items-center justify-between">
											<div>
												<h4 className="text-sm font-semibold text-white">
													{t(
														"printers.peiCalib.verifyTitle",
													)}
												</h4>
												<p className="text-xs text-bambu-gray mt-0.5">
													{t(
														"printers.peiCalib.verifyDesc",
													)}
												</p>
											</div>
											<Button
												size="sm"
												onClick={handleVerify}
												disabled={isVerifying}
											>
												{isVerifying ? (
													<>
														<Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
														{t(
															"printers.peiCalib.testingDetection",
														)}
													</>
												) : (
													<>
														<Check className="w-3.5 h-3.5 mr-1.5" />
														{t(
															"printers.peiCalib.testDetectionBtn",
														)}
													</>
												)}
											</Button>
										</div>

										{/* Verify Output */}
										{verifyResult && (
											<div className="mt-3 p-3 rounded-lg bg-bambu-dark-secondary border border-bambu-dark-tertiary space-y-2">
												<div className="flex items-center justify-between">
													<span
														className={`text-xs font-semibold px-2 py-0.5 rounded ${
															verifyResult.has_pei
																? "bg-green-500/20 text-green-400 border border-green-500/30"
																: "bg-red-500/20 text-red-400 border border-red-500/30"
														}`}
													>
														{verifyResult.has_pei
															? t(
																	"printers.peiCalib.peiDetectedBadge",
																)
															: t(
																	"printers.peiCalib.bareBedBadge",
																)}
													</span>
													<span className="text-xs text-bambu-gray">
														Score:{" "}
														{verifyResult.anomaly_score?.toFixed(
															2,
														)}{" "}
														(Thresh:{" "}
														{verifyResult.threshold?.toFixed(
															2,
														)}
														)
													</span>
												</div>
												{verifyResult.debug_image_url && (
													<div className="relative w-full rounded overflow-hidden mt-2 border border-bambu-dark-tertiary">
														<img
															src={
																verifyResult.debug_image_url
															}
															alt="Verify heatmap"
															className="w-full h-auto block"
														/>
													</div>
												)}
											</div>
										)}
									</div>
								</>
							)}
						</div>
					)}
				</div>

				{/* Footer Controls */}
				<div className="flex items-center justify-between px-6 py-4 border-t border-bambu-dark-tertiary bg-bambu-dark-secondary">
					<div>
						{currentStep === 1 && (
							<Button
								variant="ghost"
								size="sm"
								onClick={handleResetFactory}
								disabled={isResetting}
								className="text-red-400 hover:text-red-300"
							>
								{isResetting ? (
									<Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
								) : (
									<RotateCcw className="w-3.5 h-3.5 mr-1.5" />
								)}
								{t("printers.peiCalib.resetFactoryBtn")}
							</Button>
						)}
					</div>

					<div className="flex items-center gap-2">
						{currentStep > 1 && currentStep < 3 && (
							<Button
								variant="ghost"
								onClick={() =>
									setCurrentStep((s) => (s - 1) as any)
								}
							>
								<ArrowLeft className="w-4 h-4 mr-1.5" />
								{t("printers.peiCalib.prevStep")}
							</Button>
						)}

						{currentStep === 1 && (
							<Button
								onClick={() => setCurrentStep(2)}
								disabled={isPreparing}
							>
								{t("printers.peiCalib.confirmHomed")}
								<ArrowRight className="w-4 h-4 ml-1.5" />
							</Button>
						)}

						{currentStep === 2 && (
							<Button
								onClick={handleStartTraining}
								disabled={!confirmedNoPei || isCapturing}
							>
								{t("printers.peiCalib.startTraining")}
							</Button>
						)}

						{currentStep === 3 && (
							<Button onClick={onClose} disabled={isTraining}>
								{t("printers.peiCalib.finish")}
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
