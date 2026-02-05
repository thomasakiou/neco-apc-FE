import { Staff, StaffCreate } from './staff';

/**
 * Type of change detected during SDL import comparison
 */
export type ChangeType = 'NEW' | 'MODIFIED' | 'UNCHANGED';

/**
 * Represents a single field-level change between imported and existing data
 */
export interface FieldChange {
    field: string;
    fieldLabel: string;
    oldValue: string | boolean | null;
    newValue: string | boolean | null;
}

/**
 * Represents a single record in the staging table with change detection
 */
export interface SDLStagingRecord {
    fileno: string;
    fullName: string;
    importedData: StaffCreate;
    existingData?: Staff;
    changeType: ChangeType;
    fieldChanges: FieldChange[];
    isSelected: boolean;
}

/**
 * Result of committing staged changes
 */
export interface CommitResult {
    createdCount: number;
    updatedCount: number;
    errorCount: number;
    errors: { fileno: string; error: string }[];
}

/**
 * Summary statistics for staged changes
 */
export interface StagingSummary {
    totalRecords: number;
    newRecords: number;
    modifiedRecords: number;
    unchangedRecords: number;
    selectedRecords: number;
}
