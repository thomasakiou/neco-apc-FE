import { DriverAPCRecord, DriverAPCListResponse, DriverAPCCreate, DriverAPCUpdate } from '../types/driverApc';
import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const REQUEST_URL = `${API_BASE_URL}/drivers-apc`;

export const getAllDriverAPC = async (
    skip: number = 0,
    limit: number = 100,
    search: string = '',
    onlyActive: boolean = false
): Promise<DriverAPCListResponse> => {
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
        throw new Error('Failed to fetch Driver APC records');
    }
    const data: DriverAPCListResponse = await response.json();
    if (onlyActive) {
        data.items = data.items.filter(item => item.active);
        data.total = data.items.length;
    }
    return data;
};

// Cache
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let driverApcCache: { data: DriverAPCRecord[], timestamp: number } | null = null;

export const createDriverAPC = async (data: DriverAPCCreate): Promise<DriverAPCRecord> => {
    const response = await fetch(REQUEST_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create Driver APC record');
    }
    driverApcCache = null; // Invalidate
    return response.json();
};

export const updateDriverAPC = async (id: string, data: DriverAPCUpdate): Promise<DriverAPCRecord> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update Driver APC record');
    }
    driverApcCache = null; // Invalidate
    return response.json();
};

export const deleteDriverAPC = async (id: string): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete Driver APC record');
    }
    driverApcCache = null; // Invalidate
    return; // Backend might return object, void here
};

export const bulkDeleteDriverAPC = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
        throw new Error('Failed to bulk delete Driver APC records');
    }
    driverApcCache = null; // Invalidate
};

export const uploadDriverAPC = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${REQUEST_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) {
        let errorMessage = 'Failed to upload Driver APC CSV';
        try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorData.message || errorData.error || JSON.stringify(errorData);
        } catch (e) {
            const errorText = await response.text();
            errorMessage = errorText || response.statusText;
        }
        throw new Error(errorMessage);
    }
    driverApcCache = null; // Invalidate
    return response.json();
};

export const appendDriverAPC = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${REQUEST_URL}/append`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) {
        let errorMessage = 'Failed to append Driver APC records';
        try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorData.message || errorData.error || JSON.stringify(errorData);
        } catch (e) {
            const errorText = await response.text();
            errorMessage = errorText || response.statusText;
        }
        throw new Error(errorMessage);
    }
    driverApcCache = null; // Invalidate
    return response.json();
};

export const getAllDriverAPCRecords = async (onlyActive: boolean = false, force: boolean = false): Promise<DriverAPCRecord[]> => {
    if (!force && driverApcCache && (Date.now() - driverApcCache.timestamp < CACHE_TTL)) {
        return onlyActive ? driverApcCache.data.filter(item => item.active) : driverApcCache.data;
    }

    const response = await fetch(`${REQUEST_URL}?limit=100000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all Driver APC records');
    }
    const data: DriverAPCListResponse = await response.json();
    driverApcCache = { data: data.items, timestamp: Date.now() };

    let items = data.items;
    if (onlyActive) {
        items = items.filter(item => item.active);
    }
    return items;
};

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

export const getAssignmentUsage = (record: DriverAPCRecord): number => {
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

