import { SDLStagingRecord, CommitResult } from '../types/sdlStaging';
import { createStaff, updateStaff, clearAllStaffCache } from './staff';

/**
 * Commit staged SDL changes to the database.
 * Creates new records and updates modified records.
 */
export const commitStagedChanges = async (
    records: SDLStagingRecord[]
): Promise<CommitResult> => {
    const result: CommitResult = {
        createdCount: 0,
        updatedCount: 0,
        errorCount: 0,
        errors: []
    };

    // Only process selected records with actual changes
    const recordsToProcess = records.filter(r =>
        r.isSelected && (r.changeType === 'NEW' || r.changeType === 'MODIFIED')
    );

    for (const record of recordsToProcess) {
        try {
            if (record.changeType === 'NEW') {
                await createStaff(record.importedData);
                result.createdCount++;
            } else if (record.changeType === 'MODIFIED' && record.existingData) {
                // Merge imported data with existing data for update
                const updateData = {
                    ...record.importedData
                };
                await updateStaff(record.existingData.id, updateData);
                result.updatedCount++;
            }
        } catch (error: any) {
            result.errorCount++;
            result.errors.push({
                fileno: record.fileno,
                error: error.message || 'Unknown error'
            });
            console.error(`Error processing ${record.fileno}:`, error);
        }
    }

    // Clear staff cache after changes
    if (result.createdCount > 0 || result.updatedCount > 0) {
        clearAllStaffCache();
    }

    return result;
};
