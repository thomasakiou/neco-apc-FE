import { APCRecord, APCListResponse, APCCreate, APCUpdate } from '../types/apc';

import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';
import { assignmentFieldMap } from './personalizedPost';
import { getAllStaff } from './staff';
import { Staff } from '../types/staff';

const REQUEST_URL = `${API_BASE_URL}/apc`;

export const getAllAPC = async (
    skip: number = 0,
    limit: number = 100,
    search: string = '',
    onlyActive: boolean = false
): Promise<APCListResponse> => {
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });

    if (search) {
        params.append('search', search);
    }

    const response = await fetch(`${REQUEST_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch APC records');
    }
    const data: APCListResponse = await response.json();
    if (onlyActive) {
        data.items = data.items.filter(item => item.active);
        data.total = data.items.length; // Adjust total if possible, though backend total is cleaner
    }
    return data;
};

// Cache
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let apcCache: { data: APCRecord[], timestamp: number } | null = null;

export const createAPC = async (data: APCCreate): Promise<APCRecord> => {
    const response = await fetch(REQUEST_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create APC record');
    }
    apcCache = null; // Invalidate
    return response.json();
};

export const updateAPC = async (id: string, data: APCUpdate): Promise<APCRecord> => {
    console.log('updateAPC - Sending to API:', { id, data });
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error('updateAPC failed:', response.status, errorText);
        throw new Error('Failed to update APC record');
    }
    apcCache = null; // Invalidate
    return response.json();
};

export const deleteAPC = async (id: string): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete APC record');
    }
    apcCache = null; // Invalidate
};

export const bulkDeleteAPC = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
        throw new Error('Failed to bulk delete APC records');
    }
    apcCache = null; // Invalidate
};

export const uploadAPC = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${REQUEST_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) {
        let errorMessage = 'Failed to upload APC CSV';
        try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorData.message || errorData.error || JSON.stringify(errorData);
        } catch (e) {
            // If JSON parse fails, try text
            const errorText = await response.text();
            errorMessage = errorText || response.statusText;
        }
        throw new Error(errorMessage);
    }
    apcCache = null; // Invalidate
    return response.json();
};

export const appendAPC = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${REQUEST_URL}/append`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) {
        let errorMessage = 'Failed to append APC records';
        try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorData.message || errorData.error || JSON.stringify(errorData);
        } catch (e) {
            const errorText = await response.text();
            errorMessage = errorText || response.statusText;
        }
        throw new Error(errorMessage);
    }
    apcCache = null; // Invalidate
    return response.json();
};

export const getAllAPCRecords = async (onlyActive: boolean = false, force: boolean = false): Promise<APCRecord[]> => {
    if (!force && apcCache && (Date.now() - apcCache.timestamp < CACHE_TTL)) {
        return onlyActive ? apcCache.data.filter(item => item.active) : apcCache.data;
    }

    const response = await fetch(`${REQUEST_URL}?limit=100000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all APC records');
    }
    const data: APCListResponse = await response.json();
    apcCache = { data: data.items, timestamp: Date.now() };

    let items = data.items;
    if (onlyActive) {
        items = items.filter(item => item.active);
    }
    return items;
};

/**
 * Get recently auto-reactivated staff (reactivated within last 24 hours by the system).
 * These are staff who are now active and had a reactivation_date that has passed.
 */
export const getRecentReactivations = async (): Promise<APCRecord[]> => {
    try {
        const allRecords = await getAllAPCRecords(false, true);
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Find records that are active and have a reactivation_date in the recent past
        // We look for reactivation_date between 24h ago and now
        return allRecords.filter(record => {
            if (!record.active || !record.reactivation_date) return false;

            const reactivationDate = new Date(record.reactivation_date);
            return reactivationDate > oneDayAgo && reactivationDate <= now;
        });
    } catch (error) {
        console.error('Failed to get recent reactivations:', error);
        return [];
    }
};
/**
 * Determines the maximum number of assignments a staff member can undertake
 * based on their CONRAISS level.
 */
export const getAssignmentLimit = (conraiss: string | number | undefined | null): number => {
    if (!conraiss) return 1;

    // Extract numerical value from string (e.g., "CONRAISS 07" -> 7)
    const levelStr = conraiss.toString().replace(/[^0-9]/g, '');
    const level = parseInt(levelStr);

    if (isNaN(level)) return 1;

    if (level >= 3 && level <= 7) return 1;
    if (level >= 8 && level <= 9) return 2;
    if (level >= 10 && level <= 12) return 3;
    if (level >= 13 && level <= 14) return 4;

    return 1; // Default
};

/**
 * Calculates current assignment usage from an APC record.
 * Checks all assignment fields for non-empty/returned values.
 */
export const getAssignmentUsage = (record: APCRecord): number => {
    const assignmentFields = [
        'tt', 'mar_accr', 'ncee', 'gifted', 'becep', 'bece_mrkp',
        'ssce_int', 'swapping', 'ssce_int_mrk', 'oct_accr', 'ssce_ext',
        'ssce_ext_mrk', 'pur_samp', 'int_audit', 'stock_tk'
    ];

    return assignmentFields.filter(field => {
        const val = (record as any)[field];
        return val && val.toString().trim() !== '' && val.toString().trim().toUpperCase() !== 'RETURNED';
    }).length;
};

/**
 * Processes a custom APC update from CSV data.
 * CSV should have: fileno, assignment_code, mandate_code (optional)
 */
export const createCustomAPCFromCSV = async (data: { fileno: string; assignmentCode: string; mandateCode?: string }[]): Promise<any> => {
    const results = { updated: 0, errors: 0 };

    // Get current APC records to check existence
    const allAPC = await getAllAPCRecords(false, true);
    const apcMap = new Map(allAPC.map(r => [r.file_no, r]));

    for (const item of data) {
        try {
            const fieldName = assignmentFieldMap[item.assignmentCode];
            if (!fieldName) throw new Error(`Invalid assignment code: ${item.assignmentCode}`);

            const existing = apcMap.get(item.fileno);
            const val = item.mandateCode || 'Post';

            if (existing) {
                const { id, created_at, updated_at, created_by, updated_by, ...clean } = existing;
                const updatedRecord = { ...clean, [fieldName]: val };
                // Recalculate count to ensure consistency
                updatedRecord.count = getAssignmentUsage(updatedRecord as any);
                await updateAPC(id, updatedRecord);
                results.updated++;
            } else {
                results.errors++;
            }
        } catch (e) {
            results.errors++;
        }
    }
    return results;
};

/**
 * Fetches staff eligible for APC assignment.
 * Criterion: Active, !Director, !HOD, !State Coordinator
 */
export const getEligibleStaffForAPC = async (): Promise<Staff[]> => {
    const allStaff = await getAllStaff(true);
    return allStaff.filter(s =>
        !s.is_director &&
        !s.is_hod &&
        !s.is_state_coordinator &&
        !s.is_secretary &&
        !s.others
    );
};
