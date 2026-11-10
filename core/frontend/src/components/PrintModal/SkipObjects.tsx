import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
	AlertCircle,
	Box,
	CheckSquare,
	ChevronDown,
	ChevronUp,
	Loader2,
	Maximize2,
	Square,
	X,
	RotateCw,
} from "lucide-react";
import { api, type PrintableObject } from "../../api/client";
import { SkipObjectsIcon } from "../SkipObjectsModal";
import { VectorBedViewer } from "../VectorBedViewer";
import { ProBadge } from "../ProBadge";
import { useProLicense } from "../../contexts/ProLicenseContext";
import { pickObjectIdAt, plateClickToMaskPoint } from "../../utils/skipObjects";

export interface SkipObjectsProps {
	archiveId?: number | null;
	libraryFileId?: number | null;
	plateIndex?: number | null;
	plateLabel?: string;
	selectedObjectIds: number[];
	onSelectedObjectIdsChange: (ids: number[]) => void;
	onAllObjectsSkippedChange?: (allSkipped: boolean) => void;
	defaultExpanded?: boolean;
}

export function SkipObjects({
	archiveId,
	libraryFileId,
	plateIndex,
	plateLabel,
	selectedObjectIds,
	onSelectedObjectIdsChange,
	onAllObjectsSkippedChange,
	defaultExpanded = false,
}: SkipObjectsProps) {
	const { t } = useTranslation();
	const { isPro, openUpgradeModal } = useProLicense();
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);
	const [enlarged, setEnlarged] = useState(false);
	const [pickReady, setPickReady] = useState(false);
	const [topViewError, setTopViewError] = useState(false);
	const pickDataRef = useRef<ImageData | null>(null);
	const overlayRef = useRef<HTMLCanvasElement | null>(null);
	const enlargedOverlayRef = useRef<HTMLCanvasElement | null>(null);

	const effectivePlate = plateIndex ?? 1;

	const {
		data: objectsData,
		isLoading,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: [
			"printable-objects",
			archiveId,
			libraryFileId,
			effectivePlate,
		],
		queryFn: async () => {
			if (archiveId) {
				return api.getArchivePrintableObjects(
					archiveId,
					effectivePlate,
				);
			}
			if (libraryFileId) {
				return api.getLibraryFilePrintableObjects(
					libraryFileId,
					effectivePlate,
				);
			}
			return { objects: [], total: 0, skipped_count: 0, bbox_all: null };
		},
		enabled: !!archiveId || !!libraryFileId,
		staleTime: 60 * 1000,
	});

	const objects: PrintableObject[] = useMemo(
		() => objectsData?.objects ?? [],
		[objectsData],
	);
	const hasObjects = objects.length > 0;

	const topViewUrl = useMemo(() => {
		if (!hasObjects) return null;
		if (archiveId) {
			return api.getArchivePlateThumbnail(
				archiveId,
				effectivePlate,
				"top",
			);
		}
		if (libraryFileId) {
			return api.getLibraryFilePlateThumbnail(
				libraryFileId,
				effectivePlate,
				"top",
			);
		}
		return null;
	}, [archiveId, libraryFileId, effectivePlate, hasObjects]);

	const pickViewUrl = useMemo(() => {
		if (!hasObjects) return null;
		if (archiveId) {
			return api.getArchivePlateThumbnail(
				archiveId,
				effectivePlate,
				"pick",
			);
		}
		if (libraryFileId) {
			return api.getLibraryFilePlateThumbnail(
				libraryFileId,
				effectivePlate,
				"pick",
			);
		}
		return null;
	}, [archiveId, libraryFileId, effectivePlate, hasObjects]);

	const selectedSet = useMemo(
		() => new Set(selectedObjectIds),
		[selectedObjectIds],
	);

	const allSelected =
		objects.length > 0 && objects.every((obj) => selectedSet.has(obj.id));

	const onAllObjectsSkippedChangeRef = useRef(onAllObjectsSkippedChange);
	onAllObjectsSkippedChangeRef.current = onAllObjectsSkippedChange;

	useEffect(() => {
		onAllObjectsSkippedChangeRef.current?.(allSelected);
		return () => {
			onAllObjectsSkippedChangeRef.current?.(false);
		};
	}, [allSelected]);

	// Load pick mask image into memory for hit-testing
	useEffect(() => {
		pickDataRef.current = null;
		setPickReady(false);
		if (!isExpanded || !pickViewUrl) return;

		let cancelled = false;
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.onload = () => {
			if (cancelled) return;
			const canvas = document.createElement("canvas");
			canvas.width = image.naturalWidth || 512;
			canvas.height = image.naturalHeight || 512;
			const context = canvas.getContext("2d", {
				willReadFrequently: true,
			});
			if (!context) return;
			context.drawImage(image, 0, 0);
			pickDataRef.current = context.getImageData(
				0,
				0,
				canvas.width,
				canvas.height,
			);
			setPickReady(true);
		};
		image.onerror = () => {
			if (!cancelled) setPickReady(false);
		};
		image.src = pickViewUrl;

		return () => {
			cancelled = true;
		};
	}, [isExpanded, pickViewUrl]);

	// Draw overlay striped highlights for selected objects on canvas
	useEffect(() => {
		const pickData = pickDataRef.current;
		if (!pickData || !objectsData) return;

		for (const canvas of [overlayRef.current, enlargedOverlayRef.current]) {
			if (!canvas) continue;
			canvas.width = pickData.width;
			canvas.height = pickData.height;
			const context = canvas.getContext("2d");
			if (!context) continue;
			const overlay = context.createImageData(
				pickData.width,
				pickData.height,
			);

			for (let offset = 0; offset < pickData.data.length; offset += 4) {
				const objectId =
					pickData.data[offset] +
					(pickData.data[offset + 1] << 8) +
					(pickData.data[offset + 2] << 16);
				const selected = selectedSet.has(objectId);
				if (!selected) continue;
				const pixel = offset / 4;
				const x = pixel % pickData.width;
				const y = Math.floor(pixel / pickData.width);
				const stripe = (x + y) % 14 < 7;
				// Striped red-orange highlight for pre-print skipped objects
				overlay.data[offset] = stripe ? 239 : 220;
				overlay.data[offset + 1] = stripe ? 68 : 38;
				overlay.data[offset + 2] = stripe ? 68 : 38;
				overlay.data[offset + 3] = stripe ? 210 : 150;
			}
			context.putImageData(overlay, 0, 0);
		}
	}, [enlarged, objectsData, pickReady, selectedSet]);

	const toggleObject = useCallback(
		(objectId: number) => {
			if (!isPro) {
				openUpgradeModal("Skip Objects");
				return;
			}
			if (selectedSet.has(objectId)) {
				onSelectedObjectIdsChange(
					selectedObjectIds.filter((id) => id !== objectId),
				);
			} else {
				onSelectedObjectIdsChange([...selectedObjectIds, objectId]);
			}
		},
		[isPro, openUpgradeModal, selectedSet, selectedObjectIds, onSelectedObjectIdsChange],
	);

	const toggleFromPlate = useCallback(
		(event: React.MouseEvent<HTMLCanvasElement>) => {
			const pickData = pickDataRef.current;
			if (!pickData) return;
			const point = plateClickToMaskPoint(
				event.currentTarget.getBoundingClientRect(),
				pickData.width,
				pickData.height,
				event.clientX,
				event.clientY,
			);
			if (!point) return;
			const objectId = pickObjectIdAt(pickData, point.x, point.y);
			if (objectId != null) {
				const candidate = objects.find((o) => o.id === objectId);
				if (candidate) {
					toggleObject(candidate.id);
				}
			}
		},
		[objects, toggleObject],
	);

	const handleSelectAll = useCallback(() => {
		if (!isPro) {
			openUpgradeModal("Skip Objects");
			return;
		}
		if (allSelected) {
			onSelectedObjectIdsChange([]);
		} else {
			onSelectedObjectIdsChange(objects.map((o) => o.id));
		}
	}, [isPro, openUpgradeModal, allSelected, objects, onSelectedObjectIdsChange]);

	const hasValidTopView = Boolean(topViewUrl && !topViewError);
	const hasVectorPolygons =
		!hasValidTopView &&
		objects.some((obj) => obj.polygon && obj.polygon.length >= 3);
	const hasVisualPlate = hasValidTopView || hasVectorPolygons;

	const renderPlateCanvas = (large = false) => (
		<div
			className={`relative aspect-square overflow-hidden rounded-lg border border-gray-300 bg-gray-900 dark:border-gray-700 ${
				pickReady ? "cursor-crosshair" : ""
			}`}
		>
			{hasValidTopView ? (
				<img
					src={topViewUrl!}
					alt={t("printers.printPreview", "Print Preview")}
					className="absolute inset-0 h-full w-full object-contain"
					onError={() => setTopViewError(true)}
				/>
			) : (
				<div className="absolute inset-0 flex items-center justify-center">
					<Box className="h-10 w-10 text-gray-500" />
				</div>
			)}
			<canvas
				ref={large ? enlargedOverlayRef : overlayRef}
				onClick={toggleFromPlate}
				className="absolute inset-0 h-full w-full object-contain"
				aria-label={t(
					"printers.skipObjects.selectObjectsToSkip",
					"Select objects you want to skip",
				)}
			/>
			{!large && hasValidTopView && (
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation();
						setEnlarged(true);
					}}
					className="absolute right-2 top-2 rounded bg-black/65 p-1.5 text-white/80 hover:text-white transition-colors"
					title={t("common.expand", "Expand")}
				>
					<Maximize2 className="h-3.5 w-3.5" />
				</button>
			)}
		</div>
	);

	return (
		<div className="mb-4">
			{/* Accordion Toggle Header */}
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex items-center gap-2 text-sm text-bambu-gray hover:text-white transition-colors w-full"
			>
				<SkipObjectsIcon
					className={`w-4 h-4 ${
						allSelected
							? "text-red-400"
							: selectedObjectIds.length > 0
								? "text-amber-500"
								: "text-bambu-gray"
					}`}
				/>
				<span className="font-medium">
					{plateLabel
						? `${t("printModal.skipObjects", "Skip Objects")} — ${plateLabel}`
						: t("printModal.skipObjects", "Skip Objects")}
				</span>
				<ProBadge feature="Skip Objects" />
				{allSelected ? (
					<span className="text-xs font-semibold text-red-400">
						({objects.length}{" "}
						{t("printers.skipObjects.skipped", "skipped")} —{" "}
						{t("printModal.allSkipped", "All skipped")})
					</span>
				) : selectedObjectIds.length > 0 ? (
					<span className="text-xs font-medium text-amber-500 dark:text-amber-400">
						({selectedObjectIds.length}{" "}
						{t("printers.skipObjects.skipped", "skipped")})
					</span>
				) : (
					<span className="text-xs text-bambu-gray">
						(
						{objects.length > 0
							? `${objects.length} ${t("common.objects", "objects")}`
							: t("common.optional", "Optional")}
						)
					</span>
				)}
				{isExpanded ? (
					<ChevronUp className="w-4 h-4 ml-auto text-bambu-gray" />
				) : (
					<ChevronDown className="w-4 h-4 ml-auto text-bambu-gray" />
				)}
			</button>

			{/* Collapsible Content */}
			{isExpanded && (
				<div className="mt-2 bg-bambu-dark rounded-lg p-3 border border-bambu-dark-tertiary space-y-3">
					{!isPro && (
						<div className="flex items-center justify-between gap-2 p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
							<span>
								<strong>BeE Pro:</strong> {t("printModal.skipObjectsProNote", "Pre-skipping objects from queue is a Bee Pro feature.")}
							</span>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									openUpgradeModal("Skip Objects");
								}}
								className="font-bold underline text-amber-200 hover:text-white shrink-0 cursor-pointer"
							>
								{t("common.upgrade", "Upgrade")}
							</button>
						</div>
					)}
					<div className="flex items-center justify-between text-xs text-bambu-gray">
						<span>
							{t(
								"printers.skipObjects.selectObjectsToSkip",
								"Select objects you want to skip before printing",
							)}
						</span>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => refetch()}
								disabled={isFetching}
								title={t("common.refresh", "Refresh")}
								className="flex items-center gap-1 p-1 hover:text-white transition-colors disabled:opacity-50"
							>
								<RotateCw
									className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`}
								/>
							</button>
						</div>
					</div>

					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-5 w-5 animate-spin text-bambu-gray" />
						</div>
					) : objectsData?.error && objects.length === 0 ? (
						<div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
							<AlertCircle className="w-4 h-4 flex-shrink-0" />
							<div className="flex-1 min-w-0">
								<p className="font-semibold">
									{t(
										"printers.skipObjects.loadErrorTitle",
										"Failed to load objects",
									)}
								</p>
								<p className="truncate opacity-80">
									{objectsData.error_detail ||
										objectsData.error}
								</p>
							</div>
						</div>
					) : objects.length === 0 ? (
						<div className="py-6 text-center text-xs text-bambu-gray">
							<p>
								{t(
									"printModal.noObjectsFoundInFile",
									"No printable objects found in this plate/file.",
								)}
							</p>
						</div>
					) : (
						<div className="space-y-3">
							<div
								className={`grid gap-3 ${hasVisualPlate ? "grid-cols-1 md:grid-cols-[220px_1fr]" : "grid-cols-1"}`}
							>
								{/* Left Column: Plate preview canvas (Bambu raster or Non-Bambu vector) */}
								{hasVisualPlate && (
									<div className="flex flex-col gap-2">
										{hasValidTopView ? (
											renderPlateCanvas(false)
										) : (
											<VectorBedViewer
												objects={objects}
												selectedObjectIds={selectedSet}
												onToggleObject={toggleObject}
												bboxAll={objectsData?.bbox_all}
												bedSize={objectsData?.bed_size}
												onEnlarge={() => setEnlarged(true)}
											/>
										)}
										<div className="flex items-center justify-between text-[11px] text-bambu-gray">
											<span>
												{selectedObjectIds.length}/
												{objects.length}{" "}
												{t(
													"printers.skipObjects.skipped",
													"skipped",
												)}
											</span>
											{(pickReady || hasVectorPolygons) && (
												<span className="text-emerald-500 text-[10px]">
													{t(
														"printModal.clickPlateToSelect",
														"Click plate to toggle",
													)}
												</span>
											)}
										</div>
									</div>
								)}

								{/* Right Column: Objects list */}
								<div className="flex flex-col min-h-[220px] max-h-[300px] border border-bambu-dark-tertiary rounded-lg overflow-hidden bg-bambu-dark-secondary/40">
									{/* Select / Deselect All Button */}
									<button
										type="button"
										onClick={handleSelectAll}
										className="flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-white border-b border-bambu-dark-tertiary hover:bg-white/5 transition-colors"
									>
										{allSelected ? (
											<CheckSquare className="h-4 w-4 text-amber-500" />
										) : (
											<Square className="h-4 w-4 text-bambu-gray" />
										)}
										<span className="flex-1">
											{allSelected
												? t(
														"common.deselectAll",
														"Deselect All",
													)
												: t(
														"common.selectAll",
														"Select All",
													)}
										</span>
										<span className="text-[10px] font-normal text-bambu-gray">
											{objects.length}{" "}
											{t("common.objects", "objects")}
										</span>
									</button>

									{/* Scrollable list of items */}
									<div className="flex-1 overflow-y-auto divide-y divide-bambu-dark-tertiary/50">
										{objects.map((object, index) => {
											const isSelected = selectedSet.has(
												object.id,
											);
											return (
												<button
													type="button"
													key={object.id}
													onClick={() =>
														toggleObject(object.id)
													}
													className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
														isSelected
															? "bg-amber-500/15 hover:bg-amber-500/20 text-amber-300"
															: "hover:bg-white/5 text-gray-200"
													}`}
												>
													{isSelected ? (
														<CheckSquare className="h-4 w-4 flex-shrink-0 text-amber-500" />
													) : (
														<Square className="h-4 w-4 flex-shrink-0 text-bambu-gray" />
													)}
													<span className="w-5 flex-shrink-0 font-mono text-[10px] text-bambu-gray">
														{index + 1}
													</span>
													<span
														className={`min-w-0 flex-1 truncate ${
															isSelected
																? "line-through text-amber-300/90"
																: "text-gray-200"
														}`}
														title={object.name}
													>
														{object.name}
													</span>
													<span className="text-[10px] font-mono text-bambu-gray shrink-0">
														ID {object.id}
													</span>
												</button>
											);
										})}
									</div>
								</div>
							</div>

							{/* Warning alert inside expanded view when all objects are skipped */}
							{allSelected && (
								<div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
									<AlertCircle className="w-4 h-4 flex-shrink-0" />
									<span>
										{t(
											"printModal.allObjectsSkippedWarning",
											"Cannot skip all objects. At least one object must be printed.",
										)}
									</span>
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{/* Warning alert shown below the view even if collapsed when all objects are skipped */}
			{allSelected && !isExpanded && (
				<div className="flex items-center gap-2 p-2.5 mt-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
					<AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
					<span>
						{plateLabel
							? `${t("printModal.allObjectsSkippedWarning", "Cannot skip all objects. At least one object must be printed.")} (${plateLabel})`
							: t(
									"printModal.allObjectsSkippedWarning",
									"Cannot skip all objects. At least one object must be printed.",
								)}
					</span>
				</div>
			)}

			{/* Enlarged Modal for Plate Inspection */}
			{enlarged && (
				<div
					className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-8"
					onClick={() => setEnlarged(false)}
				>
					<button
						type="button"
						onClick={() => setEnlarged(false)}
						className="absolute right-4 top-4 rounded p-2 text-white/70 hover:text-white"
					>
						<X className="h-6 w-6" />
					</button>
					<div
						className="aspect-square max-h-[86vh] w-full max-w-[86vh]"
						onClick={(event) => event.stopPropagation()}
					>
						{hasValidTopView ? (
							renderPlateCanvas(true)
						) : (
							<VectorBedViewer
								objects={objects}
								selectedObjectIds={selectedSet}
								onToggleObject={toggleObject}
								bboxAll={objectsData?.bbox_all}
								bedSize={objectsData?.bed_size}
							/>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
