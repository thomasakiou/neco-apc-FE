import { HODApcRecord, HODApcListResponse, HODApcCreate, HODApcUpdate } from '../types/hodApc';
import { API_BASE_URL } from '../src/config';
import { getAuthHeaders } from './apiUtils';

const REQUEST_URL = `${API_BASE_URL}/hod-apc`;

export const getAllHODApc = async (
    skip: number = 0,
    limit: number = 100,
    search: string = '',
    onlyActive: boolean = false
): Promise<HODApcListResponse> => {
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
        throw new Error('Failed to fetch HOD APC records');
    }
    const data: HODApcListResponse = await response.json();
    if (onlyActive) {
        data.items = data.items.filter(item => item.active);
        data.total = data.items.length;
    }
    return data;
};

export const syncHODApc = async (): Promise<{ message: string; created_count: number }> => {
    const response = await fetch(`${REQUEST_URL}/sync`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to sync HOD APC records');
    }
    const result = await response.json();
    hodApcCache = null; // Invalidate cache
    return result;
};

export const updateHODApc = async (id: string, data: HODApcUpdate): Promise<HODApcRecord> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update HOD APC record');
    }
    const result = await response.json();
    hodApcCache = null; // Invalidate cache
    return result;
};

export const deleteHODApc = async (id: string): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete HOD APC record');
    }
    hodApcCache = null; // Invalidate cache
};

export const bulkDeleteHODApc = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
        throw new Error('Failed to bulk delete HOD APC records');
    }
    hodApcCache = null; // Invalidate cache
};

let hodApcCache: { data: HODApcRecord[], timestamp: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export const getAllHODApcRecords = async (onlyActive: boolean = false, force: boolean = false): Promise<HODApcRecord[]> => {
    if (!force && hodApcCache && (Date.now() - hodApcCache.timestamp < CACHE_TTL)) {
        console.log('[HOD APC Service] Returning from cache');
        return onlyActive ? hodApcCache.data.filter(item => item.active) : hodApcCache.data;
    }

    console.log('[HOD APC Service] Fetching from server');
    const response = await fetch(`${REQUEST_URL}?limit=100000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all HOD APC records');
    }
    const data: HODApcListResponse = await response.json();
    const items = data.items;

    hodApcCache = {
        data: items,
        timestamp: Date.now()
    };

    return onlyActive ? items.filter(item => item.active) : items;
};

// Assignment field mapping for HOD APC records
export const assignmentFieldMap: Record<string, string> = {
    'TT': 'tt', 'MAR-ACCR': 'mar_accr', 'NCEE': 'ncee', 'GIFTED': 'gifted',
    'BECEP': 'becep', 'BECE-MRKP': 'bece_mrkp', 'SSCE-INT': 'ssce_int',
    'SWAPPING': 'swapping', 'SSCE-INT-MRK': 'ssce_int_mrk', 'OCT-ACCR': 'oct_accr',
    'SSCE-EXT': 'ssce_ext', 'SSCE-EXT-MRK': 'ssce_ext_mrk', 'PUR-SAMP': 'pur_samp',
    'INT-AUDIT': 'int_audit', 'STOCK-TK': 'stock_tk'
};
