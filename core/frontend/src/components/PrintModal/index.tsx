import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	AlertTriangle,
	Calendar,
	Code,
	Layers,
	Loader2,
	Minus,
	Pencil,
	Plus,
	Printer,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
	PrintQueueItemCreate,
	PrintQueueItemUpdate,
	SpoolAssignment,
} from "../../api/client";
import { api, withStreamToken } from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import { Card, CardContent } from "../Card";
import { Button } from "../Button";
import { ConfirmModal } from "../ConfirmModal";
import { NumberInput } from "../NumberInput";
import { useToast } from "../../contexts/ToastContext";
import {
	buildLoadedFilaments,
	useFilamentMapping,
} from "../../hooks/useFilamentMapping";
import {
	useMultiPrinterFilamentMapping,
	type PerPrinterConfig,
} from "../../hooks/useMultiPrinterFilamentMapping";
import { getColorName } from "../../utils/colors";
import { getCurrencySymbol } from "../../utils/currency";
import { getBedTypeInfo } from "../../utils/bedType";
import { supportsLayerInspect } from "../../utils/printerModel";
import {
	toDateTimeLocalValue,
	parseUTCDate,
	formatDuration,
} from "../../utils/date";
import { getGlobalTrayId, isPlaceholderDate } from "../../utils/amsHelpers";
import { FilamentMapping } from "./FilamentMapping";
import { FilamentOverride } from "./FilamentOverride";
import { PlateSelector } from "./PlateSelector";
import { SkipObjects } from "./SkipObjects";
import { PrinterSelector } from "./PrinterSelector";
import { PrintOptionsPanel } from "./PrintOptions";
import { ScheduleOptionsPanel } from "./ScheduleOptions";
import { ElegooCc1StartOptions } from "../ElegooCc1StartOptions";
import {
	isElegooCc1Printer,
	type ElegooCc1StartOptionsValue,
} from "../../utils/elegooCc1";
import {
	getSharedSupportedPrintOptionKeys,
	sanitizePrintOptionsForPrinter,
} from "./printOptionCapabilities";
import type {
	AssignmentMode,
	PrintModalProps,
	PrintOptions,
	ScheduleOptions,
	ScheduleType,
} from "./types";
import { DEFAULT_PRINT_OPTIONS, DEFAULT_SCHEDULE_OPTIONS } from "./types";

/**
 * Unified PrintModal component that handles three modes:
 * - 'reprint': Immediate print from archive or library file (supports multi-printer)
 * - 'add-to-queue': Schedule print to queue from archive or library file (supports multi-printer)
 * - 'edit-queue-item': Edit existing queue item (supports multi-printer)
 *
 * Both archiveId and libraryFileId are supported. Library files can be printed immediately
 * or added to queue (archive is created at print start time, not when queued).
 */
export function PrintModal({
	mode,
	archiveId,
	libraryFileId,
	archiveName,
	queueItem,
	initialSelectedPrinterIds,
	onClose,
	onSuccess,
	projectId,
	cleanupLibraryAfterDispatch,
}: PrintModalProps) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const { showToast } = useToast();
	const { hasPermission } = useAuth();

	// Determine if we're printing a library file
	const isLibraryFile = !!libraryFileId && !archiveId;

	type FilamentWarningItem = {
		printerName: string;
		slotLabel: string;
		requiredGrams: number;
		remainingGrams: number;
	};

	// Multiple printer selection (used for all modes now)
	const [selectedPrinters, setSelectedPrinters] = useState<number[]>(() => {
		// Initialize with the queue item's printer if editing
		if (mode === "edit-queue-item" && queueItem?.printer_id) {
			return [queueItem.printer_id];
		}
		if (initialSelectedPrinterIds?.length) {
			return initialSelectedPrinterIds;
		}
		return [];
	});

	// Multi-select plates: in add-to-queue mode users can pick a subset of plates
	const [selectedPlates, setSelectedPlates] = useState<Set<number>>(() => {
		if (mode === "edit-queue-item" && queueItem?.plate_id != null) {
			return new Set([queueItem.plate_id]);
		}
		return new Set();
	});

	// Derived single-plate value for filament queries and single-select contexts
	const selectedPlate =
		selectedPlates.size === 1 ? [...selectedPlates][0] : null;

	// Skipped objects: object IDs to skip before printing
	const [skippedObjectIds, setSkippedObjectIds] = useState<number[]>(
		() => queueItem?.skipped_objects ?? [],
	);
	const [skippedObjectsByPlate, setSkippedObjectsByPlate] = useState<
		Record<number, number[]>
	>({});
	const [allSkippedByPlate, setAllSkippedByPlate] = useState<
		Record<number, boolean>
	>({});
	const handleAllObjectsSkippedChange = useCallback(
		(plateId: number, allSkipped: boolean) => {
			setAllSkippedByPlate((prev) => {
				if (prev[plateId] === allSkipped) return prev;
				return { ...prev, [plateId]: allSkipped };
			});
		},
		[],
	);
	const isMultiPlateSelection = selectedPlates.size > 1;
	const selectedPlateIds = useMemo(
		() => Array.from(selectedPlates),
		[selectedPlates],
	);
	const hasAllObjectsSkipped = useMemo(() => {
		if (isMultiPlateSelection) {
			return selectedPlateIds.some(
				(id) => allSkippedByPlate[id] === true,
			);
		}
		const targetPlate = selectedPlate ?? 1;
		return allSkippedByPlate[targetPlate] === true;
	}, [
		allSkippedByPlate,
		isMultiPlateSelection,
		selectedPlateIds,
		selectedPlate,
	]);

	// Quantity — number of copies (creates a batch if > 1)
	const [quantity, setQuantity] = useState(1);

	const [printOptions, setPrintOptions] = useState<PrintOptions>(() => {
		if (mode === "edit-queue-item" && queueItem) {
			return {
				bed_levelling:
					queueItem.bed_levelling ??
					DEFAULT_PRINT_OPTIONS.bed_levelling,
				flow_cali:
					queueItem.flow_cali ?? DEFAULT_PRINT_OPTIONS.flow_cali,
				vibration_cali:
					queueItem.vibration_cali ??
					DEFAULT_PRINT_OPTIONS.vibration_cali,
				layer_inspect:
					queueItem.layer_inspect ??
					DEFAULT_PRINT_OPTIONS.layer_inspect,
				timelapse:
					queueItem.timelapse ?? DEFAULT_PRINT_OPTIONS.timelapse,
			};
		}
		return DEFAULT_PRINT_OPTIONS;
	});
	const [elegooCc1StartOptions, setElegooCc1StartOptions] =
		useState<ElegooCc1StartOptionsValue>(() => ({
			bed_levelling:
				mode === "edit-queue-item" && queueItem
					? (queueItem.bed_levelling ?? true)
					: true,
			print_platform_type:
				mode === "edit-queue-item" &&
				queueItem?.print_platform_type === 1
					? 1
					: 0,
		}));

	const [scheduleOptions, setScheduleOptions] = useState<ScheduleOptions>(
		() => {
			if (mode === "edit-queue-item" && queueItem) {
				let scheduleType: ScheduleType = "asap";
				if (queueItem.manual_start) {
					scheduleType = "manual";
				} else if (
					queueItem.scheduled_time &&
					!isPlaceholderDate(queueItem.scheduled_time)
				) {
					scheduleType = "scheduled";
				}

				let scheduledTime = "";
				if (
					queueItem.scheduled_time &&
					!isPlaceholderDate(queueItem.scheduled_time)
				) {
					const date =
						parseUTCDate(queueItem.scheduled_time) ?? new Date();
					// Use toDateTimeLocalValue to convert UTC to local time for datetime-local input
					scheduledTime = toDateTimeLocalValue(date);
				}

				return {
					scheduleType,
					scheduledTime,
					requirePreviousSuccess: queueItem.require_previous_success,
					autoOffAfter: queueItem.auto_off_after,
					gcodeInjection: queueItem.gcode_injection ?? false,
					staggerEnabled: false,
					staggerGroupSize: DEFAULT_SCHEDULE_OPTIONS.staggerGroupSize,
					staggerIntervalMinutes:
						DEFAULT_SCHEDULE_OPTIONS.staggerIntervalMinutes,
				};
			}
			return DEFAULT_SCHEDULE_OPTIONS;
		},
	);

	// Manual slot overrides: slot_id (1-indexed) -> globalTrayId (default mapping for single printer or all printers)
	const [manualMappings, setManualMappings] = useState<
		Record<number, number>
	>(() => {
		if (
			mode === "edit-queue-item" &&
			queueItem?.ams_mapping &&
			Array.isArray(queueItem.ams_mapping)
		) {
			const mappings: Record<number, number> = {};
			queueItem.ams_mapping.forEach((globalTrayId, idx) => {
				if (globalTrayId !== -1) {
					mappings[idx + 1] = globalTrayId;
				}
			});
			return mappings;
		}
		return {};
	});

	// Per-printer override configs (for multi-printer selection)
	const [perPrinterConfigs, setPerPrinterConfigs] = useState<
		Record<number, PerPrinterConfig>
	>({});

	// Assignment mode: 'printer' (specific) or 'model' (any of model)
	const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>(() => {
		// Initialize from queue item if editing with target_model
		if (mode === "edit-queue-item" && queueItem?.target_model) {
			return "model";
		}
		return "printer";
	});

	// Target model for model-based assignment
	const [targetModel, setTargetModel] = useState<string | null>(() => {
		if (mode === "edit-queue-item" && queueItem?.target_model) {
			return queueItem.target_model;
		}
		return null;
	});

	// Target location for model-based assignment (optional filter)
	const [targetLocation, setTargetLocation] = useState<string | null>(() => {
		if (mode === "edit-queue-item" && queueItem?.target_location) {
			return queueItem.target_location;
		}
		return null;
	});

	// Filament overrides for model-based assignment: slot_id -> {type, color}
	const [filamentOverrides, setFilamentOverrides] = useState<
		Record<number, { type: string; color: string }>
	>(() => {
		if (mode === "edit-queue-item" && queueItem?.filament_overrides) {
			const overrides: Record<number, { type: string; color: string }> =
				{};
			for (const o of queueItem.filament_overrides) {
				overrides[o.slot_id] = { type: o.type, color: o.color };
			}
			return overrides;
		}
		return {};
	});

	// Per-slot force color match flags. Default is false (opt-in).
	const [forceColorMatch, setForceColorMatch] = useState<
		Record<number, boolean>
	>(() => {
		if (mode === "edit-queue-item" && queueItem?.filament_overrides) {
			const flags: Record<number, boolean> = {};
			for (const o of queueItem.filament_overrides) {
				flags[o.slot_id] = o.force_color_match === true;
			}
			return flags;
		}
		return {};
	});

	// Track initial values for clearing mappings on change (edit mode only)
	const [initialPrinterIds] = useState(() =>
		mode === "edit-queue-item" && queueItem?.printer_id
			? [queueItem.printer_id]
			: [],
	);
	const [initialPlateId] = useState(() =>
		mode === "edit-queue-item" && queueItem ? queueItem.plate_id : null,
	);

	// Submission state for multi-printer
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitProgress, setSubmitProgress] = useState({
		current: 0,
		total: 0,
	});

	const [filamentWarningItems, setFilamentWarningItems] = useState<
		FilamentWarningItem[] | null
	>(null);
	const [
		missingSpoolConfirmationPending,
		setMissingSpoolConfirmationPending,
	] = useState(false);

	// Track which printers have had the "Expand custom mapping by default" setting applied
	// This ensures the setting only affects initial state, not preventing unchecking
	const [initialExpandApplied, setInitialExpandApplied] = useState<
		Set<number>
	>(new Set());

	// Printer counts and effective printer for filament mapping
	const effectivePrinterCount = selectedPrinters.length;
	// For filament mapping, use first selected printer (mapping applies to all)
	const effectivePrinterId =
		selectedPrinters.length > 0 ? selectedPrinters[0] : null;

	// Queries
	const { data: settings } = useQuery({
		queryKey: ["settings"],
		queryFn: api.getSettings,
	});

	// Sync print option defaults from settings once available
	const printDefaultsApplied = useRef(false);
	useEffect(() => {
		if (
			!settings ||
			printDefaultsApplied.current ||
			mode === "edit-queue-item"
		)
			return;
		printDefaultsApplied.current = true;
		const parseBoolOpt = (
			val: boolean | string | undefined,
			fallback: boolean,
		): boolean => {
			if (typeof val === "boolean") return val;
			if (typeof val === "string") return val !== "off";
			return fallback;
		};
		setPrintOptions({
			bed_levelling: parseBoolOpt(
				settings.default_bed_levelling,
				DEFAULT_PRINT_OPTIONS.bed_levelling,
			),
			flow_cali: parseBoolOpt(
				settings.default_flow_cali,
				DEFAULT_PRINT_OPTIONS.flow_cali,
			),
			vibration_cali:
				settings.default_vibration_cali ??
				DEFAULT_PRINT_OPTIONS.vibration_cali,
			layer_inspect:
				settings.default_layer_inspect ??
				DEFAULT_PRINT_OPTIONS.layer_inspect,
			timelapse:
				settings.default_timelapse ?? DEFAULT_PRINT_OPTIONS.timelapse,
		});
	}, [settings, mode]);

	// Sync stagger defaults from settings once available
	const staggerDefaultsApplied = useRef(false);
	useEffect(() => {
		if (
			!settings ||
			staggerDefaultsApplied.current ||
			mode === "edit-queue-item"
		)
			return;
		staggerDefaultsApplied.current = true;
		setScheduleOptions((prev) => ({
			...prev,
			staggerGroupSize:
				settings.stagger_group_size ?? prev.staggerGroupSize,
			staggerIntervalMinutes:
				settings.stagger_interval_minutes ??
				prev.staggerIntervalMinutes,
		}));
	}, [settings, mode]);

	const currencySymbol = getCurrencySymbol(settings?.currency || "USD");
	const defaultCostPerKg = settings?.default_filament_cost ?? 0;

	const { data: printers, isLoading: loadingPrinters } = useQuery({
		queryKey: ["printers"],
		queryFn: api.getPrinters,
	});
	const selectedPrinterRecords = useMemo(
		() =>
			printers?.filter((printer) =>
				selectedPrinters.includes(printer.id),
			) ?? [],
		[printers, selectedPrinters],
	);
	const hasSelectedElegooCc1 = useMemo(
		() =>
			selectedPrinterRecords.some((printer) =>
				isElegooCc1Printer(printer.provider, printer.model),
			) ||
			(assignmentMode === "model" &&
				(targetModel || "").toLowerCase().includes("centauri")),
		[assignmentMode, selectedPrinterRecords, targetModel],
	);
	const isNonBambuPrinterSelected = useMemo(
		() =>
			selectedPrinterRecords.length > 0 &&
			selectedPrinterRecords.every(
				(printer) => printer.provider && printer.provider !== "bambu",
			),
		[selectedPrinterRecords],
	);
	const supportedPrintOptions = useMemo(
		() => getSharedSupportedPrintOptionKeys(selectedPrinterRecords),
		[selectedPrinterRecords],
	);

	const { data: spoolAssignments } = useQuery({
		queryKey: ["spool-assignments"],
		queryFn: () => api.getAssignments(),
		staleTime: 30 * 1000,
		enabled:
			((mode === "reprint" || mode === "add-to-queue") &&
				assignmentMode === "printer") ||
			(isLibraryFile && mode === "reprint"),
	});

	// Fetch archive details to get sliced_for_model
	const { data: archiveDetails } = useQuery({
		queryKey: ["archive", archiveId],
		queryFn: () => api.getArchive(archiveId!),
		enabled: !!archiveId && !isLibraryFile,
	});

	// Fetch library file details to get sliced_for_model
	const { data: libraryFileDetails } = useQuery({
		queryKey: ["library-file", libraryFileId],
		queryFn: () => api.getLibraryFile(libraryFileId!),
		enabled: isLibraryFile && !!libraryFileId,
	});

	// Get sliced_for_model from archive or library file
	const slicedForModel =
		archiveDetails?.sliced_for_model ||
		libraryFileDetails?.sliced_for_model ||
		null;

	// Fetch plates for archives
	const { data: archivePlatesData, isError: archivePlatesError } = useQuery({
		queryKey: ["archive-plates", archiveId],
		queryFn: () => api.getArchivePlates(archiveId!),
		enabled: !!archiveId && !isLibraryFile,
		retry: false,
	});

	// Fetch plates for library files
	const { data: libraryPlatesData } = useQuery({
		queryKey: ["library-file-plates", libraryFileId],
		queryFn: () => api.getLibraryFilePlates(libraryFileId!),
		enabled: isLibraryFile && !!libraryFileId,
	});

	// Combine plates data from either source
	const platesData = isLibraryFile ? libraryPlatesData : archivePlatesData;

	// Fetch filament requirements for archives
	const { data: archiveFilamentReqs, isError: archiveFilamentReqsError } =
		useQuery({
			queryKey: ["archive-filaments", archiveId, selectedPlate],
			queryFn: () =>
				api.getArchiveFilamentRequirements(
					archiveId!,
					selectedPlate ?? undefined,
				),
			enabled:
				!!archiveId &&
				!isLibraryFile &&
				(selectedPlate !== null || !platesData?.is_multi_plate),
			retry: false,
		});

	// Fetch filament requirements for library files (with plate support)
	const { data: libraryFilamentReqs } = useQuery({
		queryKey: ["library-file-filaments", libraryFileId, selectedPlate],
		queryFn: () =>
			api.getLibraryFileFilamentRequirements(
				libraryFileId!,
				selectedPlate ?? undefined,
			),
		enabled:
			isLibraryFile &&
			!!libraryFileId &&
			(selectedPlate !== null || !platesData?.is_multi_plate),
	});

	// Track if archive data couldn't be loaded (archive deleted or file missing)
	const archiveDataMissing =
		!isLibraryFile && (archivePlatesError || archiveFilamentReqsError);

	// Combine filament requirements from either source
	const effectiveFilamentReqs = isLibraryFile
		? libraryFilamentReqs
		: archiveFilamentReqs;
	const selectedPlateName = useMemo(() => {
		if (selectedPlate === null || !platesData?.plates?.length) {
			return undefined;
		}
		return (
			platesData.plates.find((plate) => plate.index === selectedPlate)
				?.name || undefined
		);
	}, [platesData, selectedPlate]);

	// Fetch available filaments for model-based assignment (for filament override UI)
	const { data: availableFilaments } = useQuery({
		queryKey: ["available-filaments", targetModel, targetLocation],
		queryFn: () =>
			api.getAvailableFilaments(
				targetModel!,
				targetLocation ?? undefined,
			),
		enabled: assignmentMode === "model" && !!targetModel,
	});

	// Only fetch printer status when single printer selected (for filament mapping)
	const { data: printerStatus } = useQuery({
		queryKey: ["printer-status", effectivePrinterId],
		queryFn: () => api.getPrinterStatus(effectivePrinterId!),
		enabled: !!effectivePrinterId,
	});

	// Get AMS mapping from hook (only when single printer selected)
	const { amsMapping, filamentComparison } = useFilamentMapping(
		effectiveFilamentReqs,
		printerStatus,
		manualMappings,
		settings?.prefer_lowest_filament,
		spoolAssignments,
		effectivePrinterId ?? undefined,
	);

	// Multi-printer filament mapping (for per-printer configuration)
	const multiPrinterMapping = useMultiPrinterFilamentMapping(
		selectedPrinters,
		printers,
		effectiveFilamentReqs,
		manualMappings,
		perPrinterConfigs,
		setPerPrinterConfigs,
		settings?.prefer_lowest_filament,
		spoolAssignments,
	);

	// Auto-select first plate when plates load (single or multi-plate)
	useEffect(() => {
		if (
			platesData?.plates &&
			platesData.plates.length >= 1 &&
			selectedPlates.size === 0
		) {
			setSelectedPlates(new Set([platesData.plates[0].index]));
		}
	}, [platesData, selectedPlates.size]);

	// Auto-select first printer when only one available
	useEffect(() => {
		// Skip auto-select for edit mode (already initialized from queueItem)
		if (mode === "edit-queue-item") return;
		const activePrinters = printers?.filter((p) => p.is_active) || [];
		if (activePrinters.length === 1 && selectedPrinters.length === 0) {
			setSelectedPrinters([activePrinters[0].id]);
		}
	}, [mode, printers, selectedPrinters.length]);

	// Clear manual mappings and per-printer configs when printer or plate changes
	useEffect(() => {
		if (mode === "edit-queue-item") {
			// For edit mode, clear mappings if printer selection or plate changed from initial
			const printersChanged =
				JSON.stringify(selectedPrinters.sort()) !==
				JSON.stringify(initialPrinterIds.sort());
			if (printersChanged || selectedPlate !== initialPlateId) {
				setManualMappings({});
				setPerPrinterConfigs({});
				setInitialExpandApplied(new Set());
			}
		} else {
			setManualMappings({});
			setPerPrinterConfigs({});
			setInitialExpandApplied(new Set());
		}
	}, [
		mode,
		selectedPrinters,
		selectedPlate,
		initialPrinterIds,
		initialPlateId,
	]);

	// Clear filament overrides when target model or plate changes (but not on initial mount for edit mode)
	const [prevTargetModel, setPrevTargetModel] = useState(targetModel);
	const [prevPlateForOverrides, setPrevPlateForOverrides] =
		useState(selectedPlate);
	useEffect(() => {
		if (
			targetModel !== prevTargetModel ||
			selectedPlate !== prevPlateForOverrides
		) {
			setPrevTargetModel(targetModel);
			setPrevPlateForOverrides(selectedPlate);
			// Don't clear on initial render in edit mode (values are initialized from queueItem)
			if (mode !== "edit-queue-item" || prevTargetModel !== null) {
				setFilamentOverrides({});
				setForceColorMatch({});
			}
		}
	}, [
		targetModel,
		selectedPlate,
		prevTargetModel,
		prevPlateForOverrides,
		mode,
	]);

	// Auto-expand per-printer mapping when setting is enabled and multiple printers selected
	// Only applies once per printer on initial selection, not when user unchecks
	useEffect(() => {
		if (!settings?.per_printer_mapping_expanded) return;
		if (selectedPrinters.length <= 1) return;

		// Only auto-configure printers that:
		// 1. Haven't had initial expand applied yet
		// 2. Have their status loaded (so auto-configure will actually work)
		const printersReadyForExpand = selectedPrinters.filter((printerId) => {
			if (initialExpandApplied.has(printerId)) return false;

			// Check if this printer has status loaded
			const result = multiPrinterMapping.printerResults.find(
				(r) => r.printerId === printerId,
			);
			return result && result.status && !result.isLoading;
		});

		if (printersReadyForExpand.length > 0) {
			// Mark these printers as having been initially expanded
			setInitialExpandApplied((prev) => {
				const next = new Set(prev);
				printersReadyForExpand.forEach((id) => next.add(id));
				return next;
			});

			// Auto-configure printers
			printersReadyForExpand.forEach((printerId) => {
				multiPrinterMapping.autoConfigurePrinter(printerId);
			});
		}
	}, [
		settings?.per_printer_mapping_expanded,
		selectedPrinters,
		initialExpandApplied,
		multiPrinterMapping,
	]);

	// Close on Escape key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !isSubmitting) onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose, isSubmitting]);

	const isMultiPlate = platesData?.is_multi_plate ?? false;
	const plates = platesData?.plates ?? [];

	// Per-plate quantities for multi-plate files
	const [plateQuantities, setPlateQuantities] = useState<
		Record<number, number>
	>({});
	const usePerPlateQuantities =
		mode !== "edit-queue-item" &&
		isMultiPlate &&
		plates.length > 1 &&
		(assignmentMode === "model" || selectedPrinters.length <= 1);
	const quantityForPlate = (plateId: number | null | undefined): number => {
		if (usePerPlateQuantities && plateId != null) {
			return plateQuantities[plateId] ?? 1;
		}
		return assignmentMode === "printer" && selectedPrinters.length > 1
			? 1
			: quantity;
	};

	// Show first layer inspection option only if printer supports Micro LiDAR
	const showLayerInspectOptions = useMemo(() => {
		if (assignmentMode === "model") {
			if (!targetModel) return true;
			return supportsLayerInspect(targetModel);
		}
		if (!printers || selectedPrinters.length === 0) return true;
		return selectedPrinters.some((id) => {
			const p = printers.find((pr) => pr.id === id);
			return supportsLayerInspect(p?.model);
		});
	}, [assignmentMode, targetModel, printers, selectedPrinters]);

	// Thumbnail handling for the print job header card
	const [thumbError, setThumbError] = useState(false);
	const [useFallbackThumb, setUseFallbackThumb] = useState(false);

	useEffect(() => {
		setThumbError(false);
		setUseFallbackThumb(false);
	}, [archiveId, libraryFileId, queueItem?.id, selectedPlate]);

	const mainThumbnailUrl = useMemo(() => {
		if (archiveId) {
			return api.getArchiveThumbnail(archiveId);
		}
		if (libraryFileId) {
			return api.getLibraryFileThumbnailUrl(libraryFileId);
		}
		if (queueItem) {
			if (queueItem.archive_id)
				return api.getArchiveThumbnail(queueItem.archive_id);
			if (queueItem.library_file_id)
				return api.getLibraryFileThumbnailUrl(
					queueItem.library_file_id,
				);
			if (queueItem.archive_thumbnail)
				return withStreamToken(queueItem.archive_thumbnail);
			if (queueItem.library_file_thumbnail)
				return withStreamToken(queueItem.library_file_thumbnail);
		}
		return null;
	}, [archiveId, libraryFileId, queueItem]);

	const plateThumbnailUrl = useMemo(() => {
		if (selectedPlate != null) {
			const plate = plates.find((p) => p.index === selectedPlate);
			if (plate?.has_thumbnail && plate.thumbnail_url) {
				return withStreamToken(plate.thumbnail_url);
			}
			if (plate && !plate.has_thumbnail) {
				return null;
			}
			if (archiveId)
				return api.getArchivePlateThumbnail(archiveId, selectedPlate);
			if (libraryFileId)
				return api.getLibraryFilePlateThumbnail(
					libraryFileId,
					selectedPlate,
				);
			if (queueItem?.archive_id)
				return api.getArchivePlateThumbnail(
					queueItem.archive_id,
					selectedPlate,
				);
			if (queueItem?.library_file_id)
				return api.getLibraryFilePlateThumbnail(
					queueItem.library_file_id,
					selectedPlate,
				);
		}
		if (queueItem?.plate_id != null) {
			if (queueItem.archive_id)
				return api.getArchivePlateThumbnail(
					queueItem.archive_id,
					queueItem.plate_id,
				);
			if (queueItem.library_file_id)
				return api.getLibraryFilePlateThumbnail(
					queueItem.library_file_id,
					queueItem.plate_id,
				);
		}
		return null;
	}, [archiveId, libraryFileId, queueItem, selectedPlate, plates]);

	const thumbnailUrl = useMemo(() => {
		if (!useFallbackThumb && plateThumbnailUrl) {
			return plateThumbnailUrl;
		}
		return mainThumbnailUrl;
	}, [useFallbackThumb, plateThumbnailUrl, mainThumbnailUrl]);

	const handleThumbError = useCallback(() => {
		if (
			!useFallbackThumb &&
			plateThumbnailUrl &&
			mainThumbnailUrl &&
			plateThumbnailUrl !== mainThumbnailUrl
		) {
			setUseFallbackThumb(true);
		} else {
			setThumbError(true);
		}
	}, [useFallbackThumb, plateThumbnailUrl, mainThumbnailUrl]);

	const spoolAssignmentsByPrinter = useMemo(() => {
		const map = new Map<number, Map<number, SpoolAssignment>>();
		if (!spoolAssignments) return map;
		spoolAssignments.forEach((assignment) => {
			const isExternal = assignment.ams_id === 255;
			const globalTrayId = getGlobalTrayId(
				assignment.ams_id,
				assignment.tray_id,
				isExternal,
			);
			const printerMap = map.get(assignment.printer_id) ?? new Map();
			printerMap.set(globalTrayId, assignment);
			map.set(assignment.printer_id, printerMap);
		});
		return map;
	}, [spoolAssignments]);

	const filamentWarningMessage = useMemo(() => {
		if (!filamentWarningItems || filamentWarningItems.length === 0)
			return "";
		const lines = filamentWarningItems.map((item) =>
			t("printModal.insufficientFilamentLine", {
				printer: item.printerName,
				slot: item.slotLabel,
				required: Math.round(item.requiredGrams),
				remaining: Math.round(item.remainingGrams),
			}),
		);
		return [t("printModal.insufficientFilamentMessage"), ...lines].join(
			"\n",
		);
	}, [filamentWarningItems, t]);

	// Add to queue mutation (single printer)
	const addToQueueMutation = useMutation({
		mutationFn: (data: PrintQueueItemCreate) => api.addToQueue(data),
	});

	// Update queue item mutation
	const updateQueueMutation = useMutation({
		mutationFn: (data: PrintQueueItemUpdate) =>
			api.updateQueueItem(queueItem!.id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["queue"] });
			showToast("Queue item updated");
			onSuccess?.();
			onClose();
		},
		onError: (error: Error) => {
			showToast(error.message || "Failed to update queue item", "error");
		},
	});

	const willUseStagger =
		scheduleOptions.staggerEnabled && selectedPrinters.length > 1;

	// Show filament mapping when:
	// - Single printer selected
	// - For archives: plate is selected (for multi-plate) or not required (single-plate)
	// - For library files: always show (no plate selection)
	const showFilamentMapping =
		effectivePrinterId &&
		selectedPlates.size <= 1 &&
		(isLibraryFile || (isMultiPlate ? selectedPlate !== null : true));

	const isMultiColor = useMemo(() => {
		const reqs = (effectiveFilamentReqs?.filaments ?? []).filter(
			(f) =>
				f.used_in_plate !== false &&
				(f.used_grams == null || f.used_grams > 0),
		);
		return reqs.length > 1;
	}, [effectiveFilamentReqs]);

	const hasUnassignedMultiColorSlots = useMemo(() => {
		if (assignmentMode !== "printer" || selectedPrinters.length === 0) {
			return false;
		}
		if (!isMultiColor) {
			return false;
		}

		const reqs = (effectiveFilamentReqs?.filaments ?? []).filter(
			(f) =>
				f.used_in_plate !== false &&
				(f.used_grams == null || f.used_grams > 0),
		);

		if (selectedPrinters.length === 1) {
			if (!showFilamentMapping) return false;
			if (!filamentComparison || filamentComparison.length === 0) {
				return true;
			}
			return reqs.some((req) => {
				const comp = filamentComparison.find((c) => c.slot_id === req.slot_id);
				return !comp || !comp.loaded;
			});
		}

		// Multi-printer: check each selected printer
		return selectedPrinters.some((printerId) => {
			const mapping = multiPrinterMapping.getFinalMapping(printerId);
			if (!mapping) return true;
			return reqs.some((req) => {
				const slotIdx = (req.slot_id ?? 1) - 1;
				return mapping[slotIdx] === undefined || mapping[slotIdx] < 0;
			});
		});
	}, [
		assignmentMode,
		selectedPrinters,
		isMultiColor,
		effectiveFilamentReqs,
		showFilamentMapping,
		filamentComparison,
		multiPrinterMapping,
	]);

	const handleSubmit = async (
		e?: React.FormEvent,
		options?: {
			skipFilamentCheck?: boolean;
			skipMissingSpoolConfirmation?: boolean;
		},
	) => {
		e?.preventDefault();

		if (
			!options?.skipMissingSpoolConfirmation &&
			mode === "reprint" &&
			assignmentMode === "printer"
		) {
			const [currentSettings, assignments] = await Promise.all([
				settings ?? api.getSettings(),
				spoolAssignments ?? api.getAssignments(),
			]);
			const hasUnassignedPrinter = selectedPrinters.some(
				(printerId) =>
					!assignments.some(
						(assignment) => assignment.printer_id === printerId,
					),
			);
			if (
				currentSettings.warn_on_missing_spool_assignment !== false &&
				hasUnassignedPrinter
			) {
				setMissingSpoolConfirmationPending(true);
				return;
			}
		}

		if (
			!options?.skipFilamentCheck &&
			!settings?.disable_filament_warnings &&
			(mode === "reprint" || mode === "add-to-queue") &&
			assignmentMode === "printer"
		) {
			const warningItems: FilamentWarningItem[] = [];
			const filamentReqs = effectiveFilamentReqs?.filaments ?? [];

			if (filamentReqs.length > 0 && spoolAssignmentsByPrinter.size > 0) {
				const getRemainingWeight = (
					labelWeight: number,
					weightUsed: number,
				) => {
					if (!Number.isFinite(labelWeight) || labelWeight <= 0)
						return null;
					if (!Number.isFinite(weightUsed) || weightUsed < 0)
						return null;
					return Math.max(0, labelWeight - weightUsed);
				};

				for (const printerId of selectedPrinters) {
					const printerMapping =
						selectedPrinters.length > 1
							? multiPrinterMapping.getFinalMapping(printerId)
							: amsMapping;
					if (!printerMapping) continue;

					const printerStatusForWarning =
						selectedPrinters.length > 1
							? multiPrinterMapping.printerResults.find(
									(result) => result.printerId === printerId,
								)?.status
							: printerStatus;

					const loadedFilaments = buildLoadedFilaments(
						printerStatusForWarning,
						spoolAssignments,
						printerId,
					);
					const slotLabelByTray = new Map(
						loadedFilaments.map((f) => [f.globalTrayId, f.label]),
					);
					const assignments =
						spoolAssignmentsByPrinter.get(printerId);
					const printerName =
						printers?.find((p) => p.id === printerId)?.name ??
						`Printer ${printerId}`;

					if (!assignments) continue;

					filamentReqs.forEach((req) => {
						if (!req.slot_id || req.slot_id <= 0) return;
						const globalTrayId = printerMapping[req.slot_id - 1];
						if (!Number.isFinite(globalTrayId) || globalTrayId < 0)
							return;

						const assignment = assignments.get(globalTrayId);
						const spool = assignment?.spool;
						if (!spool) return;

						const remainingGrams = getRemainingWeight(
							spool.label_weight,
							spool.weight_used,
						);
						if (remainingGrams === null) return;
						if (remainingGrams >= req.used_grams) return;

						warningItems.push({
							printerName,
							slotLabel:
								slotLabelByTray.get(globalTrayId) ??
								`Slot ${req.slot_id}`,
							requiredGrams: req.used_grams,
							remainingGrams,
						});
					});
				}
			}

			if (warningItems.length > 0) {
				setFilamentWarningItems(warningItems);
				return;
			}
		}

		// Validate printer/model selection
		if (hasUnassignedMultiColorSlots) {
			showToast(
				t(
					"printModal.unassignedMultiColorSlots",
					"Please assign all filament slots before printing multi-color.",
				),
				"error",
			);
			return;
		}
		if (hasAllObjectsSkipped) {
			showToast(
				t(
					"printModal.allObjectsSkippedWarning",
					"Cannot skip all objects. At least one object must be printed.",
				),
				"error",
			);
			return;
		}
		if (assignmentMode === "printer" && selectedPrinters.length === 0) {
			showToast("Please select at least one printer", "error");
			return;
		}
		if (assignmentMode === "model" && !targetModel) {
			showToast("Please select a target printer model", "error");
			return;
		}

		setIsSubmitting(true);
		// Calculate total API calls: plates × printers (or 1 for model-based)
		const platesToQueue =
			selectedPlates.size > 1
				? plates.filter((p) => selectedPlates.has(p.index))
				: [null];
		const totalCount =
			assignmentMode === "model"
				? platesToQueue.length
				: selectedPrinters.length * platesToQueue.length;
		setSubmitProgress({ current: 0, total: totalCount });

		const results: { success: number; failed: number; errors: string[] } = {
			success: 0,
			failed: 0,
			errors: [],
		};

		// Get mapping for a specific printer (per-printer override or default)
		const getMappingForPrinter = (
			printerId: number,
		): number[] | undefined => {
			// For multi-printer selection, check if this printer has an override
			if (selectedPrinters.length > 1) {
				const printerConfig = perPrinterConfigs[printerId];
				if (printerConfig && !printerConfig.useDefault) {
					return multiPrinterMapping.getFinalMapping(printerId);
				}
			}
			return amsMapping;
		};

		// Convert filament overrides from Record to array format for API.
		// Include all slots that either have a user override or have force_color_match enabled
		// (which is the default for model-based assignment).
		const buildFilamentOverridesArray = () => {
			const entries: Array<{
				slot_id: number;
				type: string;
				color: string;
				color_name: string;
				force_color_match: boolean;
			}> = [];

			// Process all slots from filament requirements (to capture force_color_match defaults)
			if (effectiveFilamentReqs?.filaments) {
				for (const req of effectiveFilamentReqs.filaments) {
					const userOverride = filamentOverrides[req.slot_id];
					const isForceColor = forceColorMatch[req.slot_id] ?? false;
					const effectiveType = userOverride?.type ?? req.type;
					const effectiveColor = userOverride?.color ?? req.color;

					// Include slot if user changed the filament OR force_color_match is enabled
					if (userOverride || isForceColor) {
						entries.push({
							slot_id: req.slot_id,
							type: effectiveType,
							color: effectiveColor,
							color_name: getColorName(effectiveColor),
							force_color_match: isForceColor,
						});
					}
				}
			} else {
				// Fallback: no filament requirements data — only include explicit user overrides
				for (const [slotId, { type, color }] of Object.entries(
					filamentOverrides,
				)) {
					const id = parseInt(slotId, 10);
					const isForceColor = forceColorMatch[id] ?? false;
					entries.push({
						slot_id: id,
						type,
						color,
						color_name: getColorName(color),
						force_color_match: isForceColor,
					});
				}
			}

			return entries.length > 0 ? entries : undefined;
		};

		const filamentOverridesArray = buildFilamentOverridesArray();
		const getPrinterById = (printerId: number | null) =>
			printers?.find((printer) => printer.id === printerId);
		const getPrintOptionsForPrinter = (printerId: number | null) => {
			const sanitized = sanitizePrintOptionsForPrinter(
				printOptions,
				getPrinterById(printerId),
			);
			return {
				...sanitized,
				layer_inspect: showLayerInspectOptions
					? (sanitized.layer_inspect ?? false)
					: false,
			};
		};
		const getElegooCc1OptionsForPrinter = (printerId: number | null) => {
			const printer = getPrinterById(printerId);
			if (isElegooCc1Printer(printer?.provider, printer?.model))
				return elegooCc1StartOptions;
			if (
				printerId === null &&
				assignmentMode === "model" &&
				(targetModel || "").toLowerCase().includes("centauri")
			) {
				return elegooCc1StartOptions;
			}
			return {};
		};

		// Common queue data for add-to-queue and edit modes
		const getQueueData = (
			printerId: number | null,
			plateOverride?: number | null,
		): PrintQueueItemCreate => {
			const plateSkipped =
				plateOverride != null && isMultiPlateSelection
					? skippedObjectsByPlate[plateOverride]
					: skippedObjectIds;

			return {
				printer_id: assignmentMode === "printer" ? printerId : null,
				target_model: assignmentMode === "model" ? targetModel : null,
				target_location:
					assignmentMode === "model" ? targetLocation : null,
				filament_overrides: filamentOverridesArray,
				// Use library_file_id for library files, archive_id for archives
				archive_id: isLibraryFile ? undefined : archiveId,
				library_file_id: isLibraryFile ? libraryFileId : undefined,
				require_previous_success:
					scheduleOptions.requirePreviousSuccess,
				auto_off_after: scheduleOptions.autoOffAfter,
				gcode_injection: scheduleOptions.gcodeInjection,
				manual_start: scheduleOptions.scheduleType === "manual",
				ams_mapping: printerId
					? getMappingForPrinter(printerId)
					: undefined,
				plate_id:
					plateOverride !== undefined ? plateOverride : selectedPlate,
				skipped_objects:
					plateSkipped && plateSkipped.length > 0
						? plateSkipped
						: undefined,
				scheduled_time:
					scheduleOptions.scheduleType === "scheduled" &&
					scheduleOptions.scheduledTime
						? new Date(scheduleOptions.scheduledTime).toISOString()
						: undefined,
				...getPrintOptionsForPrinter(printerId),
				...getElegooCc1OptionsForPrinter(printerId),
				project_id: projectId ?? undefined,
			};
		};

		// Model-based assignment
		if (assignmentMode === "model") {
			if (mode === "reprint") {
				showToast(
					"Model-based assignment only works with queue mode",
					"error",
				);
				setIsSubmitting(false);
				return;
			}

			let progressCounter = 0;
			for (const plate of platesToQueue) {
				progressCounter++;
				setSubmitProgress({
					current: progressCounter,
					total: totalCount,
				});
				const plateId = plate ? plate.index : selectedPlate;

				try {
					if (mode === "edit-queue-item" && !plate) {
						// Edit mode - update with target_model (only for single plate)
						const updateData: PrintQueueItemUpdate = {
							printer_id: null,
							target_model: targetModel,
							target_location: targetLocation,
							filament_overrides: filamentOverridesArray || null,
							require_previous_success:
								scheduleOptions.requirePreviousSuccess,
							auto_off_after: scheduleOptions.autoOffAfter,
							gcode_injection: scheduleOptions.gcodeInjection,
							manual_start:
								scheduleOptions.scheduleType === "manual",
							ams_mapping: undefined,
							plate_id: plateId,
							skipped_objects:
								(plateId != null && isMultiPlateSelection
									? skippedObjectsByPlate[plateId]
									: skippedObjectIds) || null,
							scheduled_time:
								scheduleOptions.scheduleType === "scheduled" &&
								scheduleOptions.scheduledTime
									? new Date(
											scheduleOptions.scheduledTime,
										).toISOString()
									: null,
							...getPrintOptionsForPrinter(null),
							...getElegooCc1OptionsForPrinter(null),
						};
						await updateQueueMutation.mutateAsync(updateData);
					} else {
						// Add-to-queue mode with model-based assignment
						const queueData = getQueueData(null, plateId);
						const runQty = quantityForPlate(plateId);
						if (runQty > 1) queueData.quantity = runQty;
						await addToQueueMutation.mutateAsync(queueData);
					}
					results.success++;
				} catch (error) {
					results.failed++;
					const plateName = plate
						? plate.name || `Plate ${plate.index}`
						: "";
					results.errors.push(
						plateName
							? `${plateName}: ${(error as Error).message}`
							: (error as Error).message,
					);
				}
			}
		} else {
			// Printer-based assignment: loop through plates × printers
			// Compute stagger base time once before the loop
			const useStagger =
				scheduleOptions.staggerEnabled &&
				(mode === "add-to-queue" || mode === "reprint") &&
				selectedPrinters.length > 1;
			const staggerBaseTime = useStagger
				? scheduleOptions.scheduleType === "scheduled" &&
					scheduleOptions.scheduledTime
					? new Date(scheduleOptions.scheduledTime).getTime()
					: Date.now()
				: 0;

			let progressCounter = 0;
			for (const plate of platesToQueue) {
				const plateId = plate ? plate.index : selectedPlate;

				for (let i = 0; i < selectedPrinters.length; i++) {
					const printerId = selectedPrinters[i];
					progressCounter++;
					setSubmitProgress({
						current: progressCounter,
						total: totalCount,
					});

					try {
						if (mode === "reprint" && !useStagger) {
							// Reprint mode - start print immediately (single plate only, multi-select not available)
							const printerMapping =
								getMappingForPrinter(printerId);
							if (isLibraryFile) {
								await api.printLibraryFile(
									libraryFileId!,
									printerId,
									{
										plate_id: selectedPlate ?? undefined,
										plate_name: selectedPlateName,
										ams_mapping: printerMapping,
										...getPrintOptionsForPrinter(printerId),
										...getElegooCc1OptionsForPrinter(
											printerId,
										),
										project_id: projectId,
										cleanup_library_after_dispatch:
											cleanupLibraryAfterDispatch,
										skipped_objects:
											skippedObjectIds.length > 0
												? skippedObjectIds
												: undefined,
									},
								);
							} else {
								// project_id is intentionally omitted here: reprintArchive targets an existing
								// archive that already carries its own project association from the original print.
								await api.reprintArchive(
									archiveId!,
									printerId,
									{
										plate_id: selectedPlate ?? undefined,
										plate_name: selectedPlateName,
										ams_mapping: printerMapping,
										...getPrintOptionsForPrinter(printerId),
										...getElegooCc1OptionsForPrinter(
											printerId,
										),
										skipped_objects:
											skippedObjectIds.length > 0
												? skippedObjectIds
												: undefined,
									},
								);
							}
							// Queue remaining copies if quantity > 1
							if (effectiveQuantity > 1) {
								const queueData = getQueueData(
									printerId,
									plateId,
								);
								queueData.quantity = effectiveQuantity - 1;
								await addToQueueMutation.mutateAsync(queueData);
							}
						} else if (
							mode === "edit-queue-item" &&
							progressCounter === 1
						) {
							// Edit mode - update the original queue item for the first entry
							const printerMapping =
								getMappingForPrinter(printerId);
							const updateData: PrintQueueItemUpdate = {
								printer_id: printerId,
								target_model: null,
								target_location: null,
								require_previous_success:
									scheduleOptions.requirePreviousSuccess,
								auto_off_after: scheduleOptions.autoOffAfter,
								gcode_injection: scheduleOptions.gcodeInjection,
								manual_start:
									scheduleOptions.scheduleType === "manual",
								ams_mapping: printerMapping,
								plate_id: plateId,
								skipped_objects:
									(plateId != null && isMultiPlateSelection
										? skippedObjectsByPlate[plateId]
										: skippedObjectIds) || null,
								scheduled_time:
									scheduleOptions.scheduleType ===
										"scheduled" &&
									scheduleOptions.scheduledTime
										? new Date(
												scheduleOptions.scheduledTime,
											).toISOString()
										: null,
								...getPrintOptionsForPrinter(printerId),
								...getElegooCc1OptionsForPrinter(printerId),
							};
							await updateQueueMutation.mutateAsync(updateData);
						} else {
							// Add-to-queue mode, stagger-reprint mode, or edit mode with additional entries
							const queueData = getQueueData(printerId, plateId);
							const runQty = quantityForPlate(plateId);
							if (runQty > 1) queueData.quantity = runQty;
							// Apply stagger offset for groups after the first
							if (useStagger) {
								const groupIndex = Math.floor(
									i / scheduleOptions.staggerGroupSize,
								);
								if (groupIndex > 0) {
									const offsetMs =
										groupIndex *
										scheduleOptions.staggerIntervalMinutes *
										60_000;
									queueData.scheduled_time = new Date(
										staggerBaseTime + offsetMs,
									).toISOString();
								}
								// Group 0 with ASAP: no scheduled_time (start immediately)
								// Group 0 with scheduled: keeps the scheduled_time from getQueueData
							}
							await addToQueueMutation.mutateAsync(queueData);
						}
						results.success++;
					} catch (error) {
						results.failed++;
						const printerName =
							printers?.find((p) => p.id === printerId)?.name ||
							`Printer ${printerId}`;
						const plateName = plate
							? plate.name || `Plate ${plate.index}`
							: "";
						const label = plateName
							? `${printerName} (${plateName})`
							: printerName;
						results.errors.push(
							`${label}: ${(error as Error).message}`,
						);
					}
				}
			}
		}

		setIsSubmitting(false);

		// Show result toast (skip for direct reprint — the dispatch toast handles it)
		if (results.failed === 0) {
			if (mode === "reprint" && willUseStagger) {
				// Stagger-reprint routed through queue
				showToast(t("queue.itemsQueued", { count: results.success }));
			} else if (mode !== "reprint") {
				if (mode === "edit-queue-item") {
					showToast("Queue item updated");
				} else if (results.success === 1) {
					showToast(
						assignmentMode === "model"
							? `Queued for any ${targetModel}`
							: t("queue.printQueued"),
					);
				} else {
					showToast(
						t("queue.itemsQueued", { count: results.success }),
					);
				}
			}
			queryClient.invalidateQueries({ queryKey: ["queue"] });
			onSuccess?.();
			onClose();
		} else if (results.success === 0) {
			showToast(`Failed: ${results.errors[0]}`, "error");
		} else {
			showToast(
				`${results.success} succeeded, ${results.failed} failed`,
				"error",
			);
			queryClient.invalidateQueries({ queryKey: ["queue"] });
		}
	};

	const isPending = isSubmitting || updateQueueMutation.isPending;

	const canSubmit = useMemo(() => {
		if (isPending) return false;

		// Need valid printer/model selection
		if (assignmentMode === "printer" && selectedPrinters.length === 0)
			return false;
		if (assignmentMode === "model" && !targetModel) return false;

		// Model-based assignment only works in queue modes (not immediate reprint)
		if (assignmentMode === "model" && mode === "reprint") return false;

		// For multi-plate files, need at least one plate selected
		if (isMultiPlate && selectedPlates.size === 0) return false;

		// Block multi-color print if required slots are not assigned
		if (hasUnassignedMultiColorSlots) return false;

		return true;
	}, [
		selectedPrinters.length,
		assignmentMode,
		targetModel,
		mode,
		isMultiPlate,
		selectedPlates.size,
		isPending,
		hasUnassignedMultiColorSlots,
	]);

	// Quantity only applies for single-printer or model-based assignment (not multi-printer)
	const effectiveQuantity =
		assignmentMode === "printer" && selectedPrinters.length > 1
			? 1
			: quantity;

	// Modal title and action button text based on mode
	const getModalConfig = () => {
		const printerCount = selectedPrinters.length;

		if (mode === "reprint") {
			const staggerReprint = willUseStagger && printerCount > 1;
			let submitText = staggerReprint
				? t("printModal.staggerToPrinters", {
						count: printerCount,
						defaultValue: "Stagger to {{count}} printers",
					})
				: printerCount > 1
					? t("queue.printToPrinters", { count: printerCount })
					: t("queue.print");
			if (effectiveQuantity > 1) {
				submitText = `${submitText} ×${effectiveQuantity}`;
			}
			return {
				title: isLibraryFile ? t("queue.print") : t("queue.reprint"),
				icon: Printer,
				submitText,
				submitIcon: staggerReprint ? Calendar : Printer,
				loadingText:
					submitProgress.total > 1
						? t("queue.sendingProgress", {
								current: submitProgress.current,
								total: submitProgress.total,
							})
						: t("queue.sending"),
			};
		}
		if (mode === "add-to-queue") {
			let submitText = t("queue.addToQueue");
			if (selectedPlates.size > 1) {
				submitText = t("queue.queueSelectedPlates", {
					count: selectedPlates.size,
				});
			} else if (printerCount > 1) {
				submitText = t("queue.queueToPrinters", {
					count: printerCount,
				});
			}
			if (effectiveQuantity > 1) {
				submitText = `${submitText} ×${effectiveQuantity}`;
			}
			return {
				title: t("queue.schedulePrint"),
				icon: Calendar,
				submitText,
				submitIcon: Calendar,
				loadingText:
					submitProgress.total > 1
						? t("queue.addingProgress", {
								current: submitProgress.current,
								total: submitProgress.total,
							})
						: t("queue.adding"),
			};
		}
		// edit-queue-item mode
		return {
			title: t("queue.editQueueItem"),
			icon: Pencil,
			submitText: t("common.save"),
			submitIcon: Pencil,
			loadingText:
				submitProgress.total > 1
					? t("queue.savingProgress", {
							current: submitProgress.current,
							total: submitProgress.total,
						})
					: t("common.saving"),
		};
	};

	const modalConfig = getModalConfig();
	const TitleIcon = modalConfig.icon;
	const SubmitIcon = modalConfig.submitIcon;

	return (
		<div
			className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
			onClick={isSubmitting ? undefined : onClose}
		>
			<Card
				className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
			>
				<CardContent className="p-0">
					{/* Header */}
					<div className="flex items-center justify-between p-4 border-b border-bambu-dark-tertiary">
						<div className="flex items-center gap-2">
							<TitleIcon className="w-5 h-5 text-bambu-green" />
							<h2 className="text-lg font-semibold text-white">
								{modalConfig.title}
							</h2>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={onClose}
							disabled={isSubmitting}
						>
							<X className="w-5 h-5" />
						</Button>
					</div>

					<form onSubmit={handleSubmit} className="p-4 space-y-4">
						{/* Print Job Header */}
						<div className="flex flex-col items-center text-center p-4 bg-bambu-dark rounded-lg border border-bambu-dark-tertiary">
							<div className="w-[150px] h-[150px] rounded-lg bg-bambu-dark-tertiary flex items-center justify-center overflow-hidden border border-bambu-dark-tertiary/80 mb-3">
								{thumbnailUrl && !thumbError ? (
									<img
										src={thumbnailUrl}
										alt={archiveName}
										className="w-full h-full object-contain"
										onError={handleThumbError}
									/>
								) : (
									<Layers className="w-10 h-10 text-bambu-gray" />
								)}
							</div>
							<div className="w-full min-w-0">
								<span className="block text-xs font-medium text-bambu-gray uppercase tracking-wider">
									{t("printModal.printJob", "Print Job")}
								</span>
								<span
									className="text-white font-semibold text-base truncate block mt-0.5"
									title={archiveName}
								>
									{archiveName}
								</span>
								{mode === "reprint" &&
									initialSelectedPrinterIds?.length === 1 &&
									printers && (
										<p className="text-xs text-bambu-gray mt-0.5">
											Send{" "}
											<span className="text-white">
												{archiveName}
											</span>{" "}
											to{" "}
											<span className="text-white">
												{printers.find(
													(p) =>
														p.id ===
														initialSelectedPrinterIds[0],
												)?.name ?? "printer(s)"}
											</span>
										</p>
									)}
								<div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-1 text-xs text-bambu-gray">
									{(() => {
										const target =
											selectedPlate != null &&
											plates.length
												? plates.find(
														(p) =>
															p.index ===
															selectedPlate,
													)
												: plates[0];
										const rawBedType =
											target?.bed_type ??
											archiveDetails?.bed_type ??
											((
												libraryFileDetails?.metadata as
													| Record<string, unknown>
													| undefined
											)?.bed_type as string | undefined);
										const bed = getBedTypeInfo(rawBedType);
										if (!bed) return null;
										return (
											<span
												className="flex items-center gap-1 truncate"
												title={bed.label}
											>
												<img
													src={bed.icon}
													alt=""
													className="w-3.5 h-3.5 object-contain flex-shrink-0"
												/>
												<span className="truncate">
													{bed.label}
												</span>
											</span>
										);
									})()}
									{(() => {
										const target =
											selectedPlate != null &&
											plates.length
												? plates.find(
														(p) =>
															p.index ===
															selectedPlate,
													)
												: plates[0];
										const printTime =
											target?.print_time_seconds ??
											archiveDetails?.print_time_seconds ??
											libraryFileDetails?.print_time_seconds;
										if (!printTime) return null;
										return (
											<span>
												{formatDuration(printTime)}
											</span>
										);
									})()}
									{(() => {
										const target =
											selectedPlate != null &&
											plates.length
												? plates.find(
														(p) =>
															p.index ===
															selectedPlate,
													)
												: plates[0];
										const filamentGrams =
											target?.filament_used_grams ??
											archiveDetails?.filament_used_grams ??
											libraryFileDetails?.filament_used_grams;
										if (
											filamentGrams == null ||
											filamentGrams <= 0
										)
											return null;
										return (
											<span>
												{filamentGrams.toFixed(1)}g
											</span>
										);
									})()}
								</div>
							</div>
						</div>

						{/* Plate selection - first so users know filament requirements before selecting printers */}
						<PlateSelector
							plates={plates}
							isMultiPlate={isMultiPlate}
							selectedPlates={selectedPlates}
							onToggle={(plateIndex) => {
								setSelectedPlates((prev) => {
									const next = new Set(prev);
									if (mode === "add-to-queue") {
										// Multi-select: toggle the plate
										if (next.has(plateIndex)) {
											next.delete(plateIndex);
										} else {
											next.add(plateIndex);
										}
									} else {
										// Single-select: replace selection
										next.clear();
										next.add(plateIndex);
									}
									return next;
								});
							}}
							onSelectAll={
								mode === "add-to-queue"
									? () =>
											setSelectedPlates(
												new Set(
													plates.map((p) => p.index),
												),
											)
									: undefined
							}
							onDeselectAll={
								mode === "add-to-queue"
									? () => setSelectedPlates(new Set())
									: undefined
							}
							multiSelect={mode === "add-to-queue"}
							quantities={
								usePerPlateQuantities
									? plateQuantities
									: undefined
							}
							onQuantityChange={
								usePerPlateQuantities
									? (plateIndex, value) =>
											setPlateQuantities((prev) => ({
												...prev,
												[plateIndex]: value,
											}))
									: undefined
							}
						/>

						{/* Printer selection with per-printer mapping — hidden when printer is pre-selected via props */}
						{!initialSelectedPrinterIds?.length && (
							<PrinterSelector
								printers={printers || []}
								selectedPrinterIds={selectedPrinters}
								onMultiSelect={setSelectedPrinters}
								isLoading={loadingPrinters}
								allowMultiple={true}
								showInactive={mode === "edit-queue-item"}
								disableBusy={mode === "reprint"}
								printerMappingResults={
									multiPrinterMapping.printerResults
								}
								filamentReqs={effectiveFilamentReqs}
								onAutoConfigurePrinter={
									multiPrinterMapping.autoConfigurePrinter
								}
								onUpdatePrinterConfig={
									multiPrinterMapping.updatePrinterConfig
								}
								assignmentMode={
									mode === "reprint"
										? "printer"
										: assignmentMode
								}
								onAssignmentModeChange={
									mode !== "reprint"
										? setAssignmentMode
										: undefined
								}
								targetModel={targetModel}
								onTargetModelChange={
									mode !== "reprint"
										? setTargetModel
										: undefined
								}
								targetLocation={targetLocation}
								onTargetLocationChange={
									mode !== "reprint"
										? setTargetLocation
										: undefined
								}
								slicedForModel={slicedForModel}
							/>
						)}

						{/* Filament override - shown in model mode when filament requirements are available */}
						{assignmentMode === "model" &&
							targetModel &&
							effectiveFilamentReqs &&
							availableFilaments &&
							availableFilaments.length > 0 && (
								<FilamentOverride
									filamentReqs={effectiveFilamentReqs}
									availableFilaments={availableFilaments}
									overrides={filamentOverrides}
									onChange={setFilamentOverrides}
									forceColorMatch={forceColorMatch}
									onForceColorMatchChange={(slotId, value) =>
										setForceColorMatch((prev) => ({
											...prev,
											[slotId]: value,
										}))
									}
								/>
							)}

						{/* Compatibility warning when sliced model doesn't match selected printer */}
						{slicedForModel &&
							assignmentMode === "printer" &&
							selectedPrinters.length === 1 &&
							(() => {
								const selectedPrinter = printers?.find(
									(p) => p.id === selectedPrinters[0],
								);
								if (
									selectedPrinter &&
									selectedPrinter.model &&
									slicedForModel !== selectedPrinter.model
								) {
									return (
										<div className="p-3 mb-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2">
											<AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
											<span className="text-sm text-yellow-400">
												File was sliced for{" "}
												{slicedForModel}, but printing
												on {selectedPrinter.model}
											</span>
										</div>
									);
								}
								return null;
							})()}

						{/* Warning when archive data couldn't be loaded */}
						{archiveDataMissing && (
							<div className="flex items-start gap-2 p-3 mb-2 bg-orange-500/10 border border-orange-500/30 rounded-lg text-sm">
								<AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
								<p className="text-orange-400">
									Archive data unavailable. The source file
									may have been deleted. Filament mapping is
									disabled.
								</p>
							</div>
						)}

						{/* Filament mapping - only show when single printer selected */}
						{showFilamentMapping &&
							!archiveDataMissing &&
							selectedPrinters.length === 1 && (
								<FilamentMapping
									printerId={effectivePrinterId!}
									filamentReqs={effectiveFilamentReqs}
									manualMappings={manualMappings}
									onManualMappingChange={setManualMappings}
									quantity={effectiveQuantity}
									defaultExpanded={
										!!initialSelectedPrinterIds?.length ||
										(settings?.per_printer_mapping_expanded ??
											false)
									}
									currencySymbol={currencySymbol}
									defaultCostPerKg={defaultCostPerKg}
									forceColorMatch={forceColorMatch}
									onForceColorMatchChange={(slotId, value) =>
										setForceColorMatch((prev) => ({
											...prev,
											[slotId]: value,
										}))
									}
								/>
							)}

						{/* Skip Objects — grouped alongside Filament Mapping and Print Options */}
						{!isMultiPlateSelection && (
							<SkipObjects
								archiveId={archiveId}
								libraryFileId={libraryFileId}
								plateIndex={
									selectedPlate ?? plates[0]?.index ?? 1
								}
								selectedObjectIds={skippedObjectIds}
								onSelectedObjectIdsChange={setSkippedObjectIds}
								onAllObjectsSkippedChange={(allSkipped) =>
									handleAllObjectsSkippedChange(
										selectedPlate ?? plates[0]?.index ?? 1,
										allSkipped,
									)
								}
								defaultExpanded={false}
							/>
						)}

						{isMultiPlateSelection &&
							selectedPlateIds.map((plateId) => {
								const plate = plates.find(
									(p) => p.index === plateId,
								);
								return (
									<SkipObjects
										key={plateId}
										archiveId={archiveId}
										libraryFileId={libraryFileId}
										plateIndex={plateId}
										plateLabel={
											plate?.name ||
											t(
												"printModal.plateN",
												"Plate {{n}}",
												{ n: plateId },
											)
										}
										selectedObjectIds={
											skippedObjectsByPlate[plateId] ?? []
										}
										onSelectedObjectIdsChange={(ids) =>
											setSkippedObjectsByPlate(
												(prev) => ({
													...prev,
													[plateId]: ids,
												}),
											)
										}
										onAllObjectsSkippedChange={(
											allSkipped,
										) =>
											handleAllObjectsSkippedChange(
												plateId,
												allSkipped,
											)
										}
										defaultExpanded={false}
									/>
								);
							})}

						{hasSelectedElegooCc1 && (
							<ElegooCc1StartOptions
								value={elegooCc1StartOptions}
								onChange={setElegooCc1StartOptions}
							/>
						)}

						{/* Print options */}
						{(mode === "reprint" ||
							effectivePrinterCount > 0 ||
							(assignmentMode === "model" && targetModel)) && (
							<PrintOptionsPanel
								options={printOptions}
								onChange={setPrintOptions}
								defaultExpanded={
									(isNonBambuPrinterSelected &&
										effectivePrinterCount > 0) ||
									!!initialSelectedPrinterIds?.length
								}
								supportedOptions={supportedPrintOptions}
								showLayerInspectOptions={
									showLayerInspectOptions
								}
							/>
						)}

						{/* Quantity — create multiple copies (batch). Hidden for multi-printer selection and per-plate quantities. */}
						{mode !== "edit-queue-item" &&
							!usePerPlateQuantities &&
							(assignmentMode === "model" ||
								selectedPrinters.length <= 1) && (
								<div className="flex items-center gap-3">
									<label
										htmlFor="printQuantity"
										className="text-sm text-bambu-gray whitespace-nowrap"
									>
										{t("queue.quantity", "Quantity")}
									</label>
									<div className="flex items-center">
										<button
											type="button"
											onClick={() =>
												setQuantity((q) =>
													Math.max(1, q - 1),
												)
											}
											disabled={quantity <= 1}
											aria-label="Decrease quantity"
											className="p-1.5 bg-bambu-dark border border-bambu-dark-tertiary rounded-l text-bambu-gray hover:text-white hover:bg-bambu-dark-tertiary disabled:opacity-40 disabled:hover:bg-bambu-dark disabled:hover:text-bambu-gray transition-colors"
										>
											<Minus className="w-3.5 h-3.5" />
										</button>
										<NumberInput
											id="printQuantity"
											min={1}
											max={999}
											value={quantity}
											onChange={setQuantity}
											fallback={1}
											className="w-14 px-2 py-1 text-sm bg-bambu-dark border-y border-bambu-dark-tertiary text-center text-white focus:outline-none focus:ring-1 focus:ring-bambu-green"
										/>
										<button
											type="button"
											onClick={() =>
												setQuantity((q) =>
													Math.min(999, q + 1),
												)
											}
											disabled={quantity >= 999}
											aria-label="Increase quantity"
											className="p-1.5 bg-bambu-dark border border-bambu-dark-tertiary rounded-r text-bambu-gray hover:text-white hover:bg-bambu-dark-tertiary disabled:opacity-40 disabled:hover:bg-bambu-dark disabled:hover:text-bambu-gray transition-colors"
										>
											<Plus className="w-3.5 h-3.5" />
										</button>
									</div>
									{quantity > 1 && (
										<span className="text-xs text-bambu-gray">
											{t(
												"queue.quantityHint",
												"Creates {{count}} queue items",
												{ count: quantity },
											)}
										</span>
									)}
								</div>
							)}

						{/* Stagger option for reprint mode with multiple printers */}
						{mode === "reprint" &&
							assignmentMode === "printer" &&
							selectedPrinters.length > 1 && (
								<div className="space-y-2 pb-2">
									<div className="flex items-center gap-2">
										<input
											type="checkbox"
											id="staggerEnabledReprint"
											checked={
												scheduleOptions.staggerEnabled
											}
											onChange={(e) =>
												setScheduleOptions({
													...scheduleOptions,
													staggerEnabled:
														e.target.checked,
												})
											}
											className="rounded border-bambu-dark-tertiary bg-bambu-dark text-bambu-green focus:ring-bambu-green"
										/>
										<label
											htmlFor="staggerEnabledReprint"
											className="text-sm flex items-center gap-1 text-bambu-gray"
										>
											<Layers className="w-3.5 h-3.5" />
											{t(
												"printModal.staggerPrinterStarts",
												"Stagger printer starts",
											)}
										</label>
									</div>
									{scheduleOptions.staggerEnabled &&
										(() => {
											const groupSize =
												scheduleOptions.staggerGroupSize;
											const interval =
												scheduleOptions.staggerIntervalMinutes;
											const groupCount = Math.ceil(
												selectedPrinters.length /
													groupSize,
											);
											const totalMinutes =
												(groupCount - 1) * interval;
											return (
												<p className="ml-6 text-xs text-bambu-gray">
													{t(
														"printModal.staggerPreview",
														"{{printers}} printers → {{groups}} groups of {{size}}, starting every {{interval}} min",
														{
															printers:
																selectedPrinters.length,
															groups: groupCount,
															size: groupSize,
															interval,
														},
													)}
													{groupCount > 1
														? ` (${t("printModal.staggerTotal", "total: {{minutes}} min", { minutes: totalMinutes })})`
														: ""}
												</p>
											);
										})()}
								</div>
							)}

						{/* Schedule options - only for queue modes */}
						{mode !== "reprint" && (
							<ScheduleOptionsPanel
								options={scheduleOptions}
								onChange={setScheduleOptions}
								dateFormat={settings?.date_format || "system"}
								timeFormat={settings?.time_format || "system"}
								canControlPrinter={hasPermission(
									"printers:control",
								)}
								showStagger={
									mode === "add-to-queue" &&
									assignmentMode === "printer" &&
									selectedPrinters.length > 1
								}
								printerCount={selectedPrinters.length}
								hasGcodeSnippets={!!settings?.gcode_snippets}
							/>
						)}

						{/* G-code injection for reprint mode (only shown when quantity > 1 — applies to queued copies) */}
						{mode === "reprint" &&
							!!settings?.gcode_snippets &&
							effectiveQuantity > 1 && (
								<div className="flex items-center gap-2">
									<input
										type="checkbox"
										id="gcodeInjectionReprint"
										checked={scheduleOptions.gcodeInjection}
										onChange={(e) =>
											setScheduleOptions({
												...scheduleOptions,
												gcodeInjection:
													e.target.checked,
											})
										}
										className="rounded border-bambu-dark-tertiary bg-bambu-dark text-bambu-green focus:ring-bambu-green"
									/>
									<label
										htmlFor="gcodeInjectionReprint"
										className="text-sm flex items-center gap-1 text-bambu-gray"
									>
										<Code className="w-3.5 h-3.5" />
										{t(
											"printModal.gcodeInjection",
											"Inject auto-print G-code",
										)}
									</label>
								</div>
							)}

						{/* Error message */}
						{updateQueueMutation.isError && (
							<div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-400">
								{(updateQueueMutation.error as Error)
									?.message || "Failed to complete operation"}
							</div>
						)}

						{/* Actions */}
						<div
							className={`flex gap-3 ${mode === "reprint" ? "" : "pt-2"}`}
						>
							<Button
								type="button"
								variant="secondary"
								onClick={onClose}
								className="flex-1"
								disabled={isSubmitting}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={!canSubmit}
								className="flex-1"
								title={
									hasUnassignedMultiColorSlots
										? t(
												"printModal.unassignedMultiColorSlots",
												"Please assign all filament slots before printing multi-color.",
											)
										: undefined
								}
							>
								{isPending ? (
									<>
										<Loader2 className="w-4 h-4 animate-spin" />
										{modalConfig.loadingText}
									</>
								) : (
									<>
										<SubmitIcon className="w-4 h-4" />
										{modalConfig.submitText}
									</>
								)}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>

			{filamentWarningItems && filamentWarningItems.length > 0 && (
				<ConfirmModal
					title={t("printModal.insufficientFilamentTitle")}
					message={filamentWarningMessage}
					confirmText={t("printModal.printAnyway")}
					cancelText={t("common.cancel")}
					variant="warning"
					onConfirm={() => {
						setFilamentWarningItems(null);
						void handleSubmit(undefined, {
							skipFilamentCheck: true,
						});
					}}
					onCancel={() => setFilamentWarningItems(null)}
				/>
			)}
			{missingSpoolConfirmationPending && (
				<ConfirmModal
					title={t("settings.missingSpoolAssignmentStartTitle")}
					message={t("settings.missingSpoolAssignmentStartMessage")}
					confirmText={t("settings.startPrintAnyway")}
					variant="warning"
					overlayZIndex="z-[60]"
					onConfirm={() => {
						setMissingSpoolConfirmationPending(false);
						void handleSubmit(undefined, {
							skipMissingSpoolConfirmation: true,
						});
					}}
					onCancel={() => setMissingSpoolConfirmationPending(false)}
				/>
			)}
		</div>
	);
}

// Re-export types for convenience
export type { PrintModalMode, PrintModalProps } from "./types";
