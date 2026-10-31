import type { PrintQueueItem, Printer } from '../../api/client';

/**
 * Mode of operation for the PrintModal.
 * - 'reprint': Immediate print from archive (no schedule options)
 * - 'add-to-queue': Schedule print to queue (includes schedule options)
 * - 'edit-queue-item': Edit existing queue item (all options + existing values)
 */
export type PrintModalMode = 'reprint' | 'add-to-queue' | 'edit-queue-item';

/**
 * Props for the unified PrintModal component.
 *
 * Either archiveId or libraryFileId must be provided.
 * - archiveId: For reprinting/queueing archives
 * - libraryFileId: For printing library files directly
 */
export interface PrintModalProps {
  /** Modal operation mode */
  mode: PrintModalMode;
  /** Archive ID to print (mutually exclusive with libraryFileId) */
  archiveId?: number;
  /** Library file ID to print (mutually exclusive with archiveId) */
  libraryFileId?: number;
  /** Display name for the print */
  archiveName: string;
  /** Existing queue item (only for edit-queue-item mode) */
  queueItem?: PrintQueueItem;
  /** Pre-select specific printers when opening the modal */
  initialSelectedPrinterIds?: number[];
  /** Handler for closing the modal */
  onClose: () => void;
  /** Handler for successful operation */
  onSuccess?: () => void;
  /** Project ID to associate the resulting archive with (only when triggered from project view) */
  projectId?: number;
  /** Delete the LibraryFile after dispatch — used by the Printers-page Direct-Print flow
   *  so transient uploads don't linger in File Manager. Only applies to library-file prints. */
  cleanupLibraryAfterDispatch?: boolean;
}

/**
 * Print options that can be configured for a print job.
 */
export interface PrintOptions {
  bed_levelling: boolean;
  flow_cali: boolean;
  vibration_cali: boolean;
  layer_inspect: boolean;
  timelapse: boolean;
}

/**
 * Default print options values.
 */
export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  bed_levelling: true,
  flow_cali: false,
  vibration_cali: true,
  layer_inspect: false,
  timelapse: false,
};

/**
 * Schedule type for queue items.
 */
export type ScheduleType = 'asap' | 'scheduled' | 'manual';

/**
 * Schedule options for queue items.
 */
export interface ScheduleOptions {
  scheduleType: ScheduleType;
  scheduledTime: string;
  requirePreviousSuccess: boolean;
  autoOffAfter: boolean;
  gcodeInjection: boolean;
  staggerEnabled: boolean;
  staggerGroupSize: number;
  staggerIntervalMinutes: number;
}

/**
 * Default schedule options values.
 */
export const DEFAULT_SCHEDULE_OPTIONS: ScheduleOptions = {
  scheduleType: 'asap',
  scheduledTime: '',
  requirePreviousSuccess: false,
  autoOffAfter: false,
  gcodeInjection: false,
  staggerEnabled: false,
  staggerGroupSize: 2,
  staggerIntervalMinutes: 5,
};

/**
 * Plate information from a multi-plate 3MF file.
 */
export interface PlateInfo {
  index: number;
  name: string | null;
  has_thumbnail: boolean;
  thumbnail_url: string | null;
  objects: string[];
  filaments: Array<{
    type: string;
    color: string;
  }>;
  print_time_seconds: number | null;
  filament_used_grams: number | null;
  bed_type?: string | null;  // Build plate type for this plate, e.g. "Textured PEI Plate" (#1281)
}

/**
 * Response from the archive plates API.
 */
export interface PlatesResponse {
  is_multi_plate: boolean;
  plates: PlateInfo[];
}

/**
 * Assignment mode for queue items.
 * - 'printer': Assign to specific printer(s)
 * - 'model': Assign to any printer of a specific model (load balancing)
 */
export type AssignmentMode = 'printer' | 'model';

/**
 * Props for the PrinterSelector component.
 */
export interface PrinterSelectorProps {
  printers: Printer[];
  selectedPrinterIds: number[];
  onMultiSelect: (printerIds: number[]) => void;
  isLoading?: boolean;
  allowMultiple?: boolean;
  /** Show inactive printers (for edit mode where original assignment may be inactive) */
  showInactive?: boolean;
  /** Disable selection of busy printers (used in reprint mode) */
  disableBusy?: boolean;
  /** Current assignment mode */
  assignmentMode?: AssignmentMode;
  /** Handler for assignment mode change */
  onAssignmentModeChange?: (mode: AssignmentMode) => void;
  /** Selected target model (when assignmentMode is 'model') */
  targetModel?: string | null;
  /** Handler for target model change */
  onTargetModelChange?: (model: string | null) => void;
  /** Selected target location (when assignmentMode is 'model') */
  targetLocation?: string | null;
  /** Handler for target location change */
  onTargetLocationChange?: (location: string | null) => void;
  /** Suggested model from sliced file (for pre-selection) */
  slicedForModel?: string | null;
}

/**
 * Props for the PlateSelector component.
 */
export interface PlateSelectorProps {
  plates: PlateInfo[];
  isMultiPlate: boolean;
  selectedPlates: Set<number>;
  onToggle: (plateIndex: number) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  /** Whether multi-select (checkboxes) is enabled — true in add-to-queue mode */
  multiSelect?: boolean;
  /**
   * How many runs of each plate to queue, keyed by plate index (#342). When
   * provided, each selected plate gets its own quantity control and the
   * modal's single global Quantity field is hidden.
   */
  quantities?: Record<number, number>;
  onQuantityChange?: (plateIndex: number, quantity: number) => void;
}

/** A filament group's hotend requirements, from the 3MF (#1784). */
export interface RackGroupInfo {
  on_rack: boolean;
  nozzle_diameter: string;
  volume_type: string;
  filament_color: string;
}

/** One position on the H2C's six-slot nozzle rack, as offered to the user. */
export interface RackPositionOption {
  /** 1-based, the way the printer card, BambuStudio and the operator count. */
  position: number;
  diameter: string;
  nozzleType: string;
  filamentColor: string;
  /** False when the position is empty or holds the wrong nozzle for the group. */
  eligible: boolean;
  /** Why not, when `eligible` is false — shown as the option's title. */
  reason?: string;
}

/**
 * Filament requirement data structure.
 */
export interface FilamentReqsData {
  filaments: Array<{
    slot_id: number;
    type: string;
    color: string;
    used_grams: number;
    used_meters: number;
    nozzle_id?: number;
    tray_info_idx?: string;
    group_id?: number;
    group?: RackGroupInfo;
  }>;
}

/**
 * Props for the FilamentMapping component.
 */
export interface FilamentMappingProps {
  printerId: number;
  /** Pre-fetched filament requirements data */
  filamentReqs: FilamentReqsData | undefined;
  manualMappings: Record<number, number>;
  onManualMappingChange: (mappings: Record<number, number>) => void;
  onEstimatedCostChange?: (estimatedCost: number | null) => void;
  budgetAvailable?: number | null;
  quantity?: number;
  currencySymbol: string;
  defaultCostPerKg: number;
  /** Per-slot force-color-match flags. */
  forceColorMatch?: Record<number, boolean>;
  /** Called when a slot's force-color-match checkbox is toggled. */
  onForceColorMatchChange?: (slotId: number, value: boolean) => void;
  /** Names the plate this panel maps, when one panel is rendered per selected plate. */
  plateLabel?: string;
  /** The archive's own saved AMS-slot pick from the slicer. */
  archiveAmsMapping?: number[];
  /** The operator's rack-position pick per filament group (#1784), keyed by group id. */
  nozzleRackChoice?: Record<number, number>;
  /** Called when a rack position is picked for a group. */
  onNozzleRackChoiceChange?: (choice: Record<number, number>) => void;
}

/**
 * Props for the PrintOptions component.
 */
export interface PrintOptionsProps {
  options: PrintOptions;
  onChange: (options: PrintOptions) => void;
  defaultExpanded?: boolean;
  supportedOptions?: Array<keyof PrintOptions>;
  showDualNozzleOptions?: boolean;
  showLayerInspectOptions?: boolean;
}

/**
 * Props for the ScheduleOptions component.
 */
export interface ScheduleOptionsProps {
  options: ScheduleOptions;
  onChange: (options: ScheduleOptions) => void;
  /** Date format setting from user preferences */
  dateFormat?: 'system' | 'us' | 'eu' | 'iso';
  /** Time format setting from user preferences */
  timeFormat?: 'system' | '12h' | '24h';
  /** Whether the user has permission to control printers (for auto power off) */
  canControlPrinter?: boolean;
  /** Show stagger options (only when multiple printers selected in queue mode) */
  showStagger?: boolean;
  /** Number of selected printers (for stagger preview) */
  printerCount?: number;
  /** Whether G-code snippets are configured in settings */
  hasGcodeSnippets?: boolean;
}
