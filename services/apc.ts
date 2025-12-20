import { APCRecord, APCListResponse, APCCreate, APCUpdate } from '../types/apc';

import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

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
let apcCache: APCRecord[] | null = null;

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
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
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

export const getAllAPCRecords = async (onlyActive: boolean = false, force: boolean = false): Promise<APCRecord[]> => {
    if (apcCache && !force) {
        return onlyActive ? apcCache.filter(item => item.active) : apcCache;
    }

    const response = await fetch(`${REQUEST_URL}?limit=100000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all APC records');
    }
    const data: APCListResponse = await response.json();
    apcCache = data.items;

    let items = data.items;
    if (onlyActive) {
        items = items.filter(item => item.active);
    }
    return items;
};
