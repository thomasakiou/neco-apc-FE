import { TypesettingAPCRecord, TypesettingAPCListResponse, TypesettingAPCCreate, TypesettingAPCUpdate } from '../types/typesettingApc';
import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const REQUEST_URL = `${API_BASE_URL}/typsetting-apc`;

export const assignmentFieldMap: { [key: string]: string } = {
    'TT': 'tt',
    'SSCE-INT': 'ssce_int',
    'SSCE INTERNAL EXAMINATION': 'ssce_int',
    'SSCE-EXT': 'ssce_ext',
    'SSCE-INT-MRK': 'ssce_int_mrk',
    'SSCE-EXT-MRK': 'ssce_ext_mrk',
    'NCEE': 'ncee',
    'BECEP': 'becep',
    'BECE-MRKP': 'bece_mrkp',
    'GIFTED': 'gifted',
    'SWAPPING': 'swapping',
    'MAR-ACCR': 'mar_accr',
    'OCT-ACCR': 'oct_accr',
    'PUR-SAMP': 'pur_samp',
    'INT-AUDIT': 'int_audit',
    'STOCK-TK': 'stock_tk'
};

export const getAllTypesettingAPC = async (
    skip: number = 0,
    limit: number = 100,
    search: string = '',
    onlyActive: boolean = false
): Promise<TypesettingAPCListResponse> => {
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
        throw new Error('Failed to fetch Typesetting APC records');
    }
    const data: TypesettingAPCListResponse = await response.json();
    if (onlyActive) {
        data.items = data.items.filter(item => item.active);
        data.total = data.items.length;
    }
    return data;
};

// Cache
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let typesettingApcCache: { data: TypesettingAPCRecord[], timestamp: number } | null = null;

export const createTypesettingAPC = async (data: TypesettingAPCCreate): Promise<TypesettingAPCRecord> => {
    const response = await fetch(REQUEST_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create Typesetting APC record');
    }
    typesettingApcCache = null; // Invalidate
    return response.json();
};

export const updateTypesettingAPC = async (id: string, data: TypesettingAPCUpdate): Promise<TypesettingAPCRecord> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update Typesetting APC record');
    }
    typesettingApcCache = null; // Invalidate
    return response.json();
};

export const deleteTypesettingAPC = async (id: string): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete Typesetting APC record');
    }
    typesettingApcCache = null; // Invalidate
    return;
};

export const bulkDeleteTypesettingAPC = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
        throw new Error('Failed to bulk delete Typesetting APC records');
    }
    typesettingApcCache = null; // Invalidate
};

export const uploadTypesettingAPC = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${REQUEST_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) {
        let errorMessage = 'Failed to upload Typesetting APC CSV';
        try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorData.message || errorData.error || JSON.stringify(errorData);
        } catch (e) {
            const errorText = await response.text();
            errorMessage = errorText || response.statusText;
        }
        throw new Error(errorMessage);
    }
    typesettingApcCache = null; // Invalidate
    return response.json();
};

export const appendTypesettingAPC = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${REQUEST_URL}/append`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) {
        let errorMessage = 'Failed to append Typesetting APC records';
        try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorData.message || errorData.error || JSON.stringify(errorData);
        } catch (e) {
            const errorText = await response.text();
            errorMessage = errorText || response.statusText;
        }
        throw new Error(errorMessage);
    }
    typesettingApcCache = null; // Invalidate
    return response.json();
};

export const getAllTypesettingAPCRecords = async (onlyActive: boolean = false, force: boolean = false): Promise<TypesettingAPCRecord[]> => {
    if (!force && typesettingApcCache && (Date.now() - typesettingApcCache.timestamp < CACHE_TTL)) {
        return onlyActive ? typesettingApcCache.data.filter(item => item.active) : typesettingApcCache.data;
    }

    const response = await fetch(`${REQUEST_URL}?limit=100000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all Typesetting APC records');
    }
    const data: TypesettingAPCListResponse = await response.json();
    typesettingApcCache = { data: data.items, timestamp: Date.now() };

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

export const getAssignmentUsage = (record: TypesettingAPCRecord): number => {
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

