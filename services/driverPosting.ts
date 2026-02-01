import { DriverPostingResponse, DriverPostingCreate, DriverPostingListResponse, BulkDriverPostingCreateRequest, DriverPostingBulkUploadResponse } from '../types/driverPosting';
import { API_BASE_URL } from '../src/config';
import { getAuthHeaders } from './apiUtils';

const REQUEST_URL = `${API_BASE_URL}/drivers-posting`;

let postingCache: DriverPostingResponse[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getAllDriverPostings = async (forceRefresh: boolean = false): Promise<DriverPostingResponse[]> => {
    const now = Date.now();
    if (!forceRefresh && postingCache && (now - lastFetchTime) < CACHE_DURATION) {
        return postingCache;
    }

    const response = await fetch(`${REQUEST_URL}?limit=100000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch Driver posting records');
    }
    const data: DriverPostingListResponse = await response.json();
    postingCache = data.items;
    lastFetchTime = now;
    return data.items;
};

export const getDriverPostingById = async (id: string): Promise<DriverPostingResponse> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch Driver posting record');
    }
    return response.json();
};

export const createDriverPosting = async (data: DriverPostingCreate): Promise<DriverPostingResponse> => {
    const response = await fetch(REQUEST_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create Driver posting record');
    }
    postingCache = null; // Invalidate cache
    return response.json();
};

export const updateDriverPosting = async (id: string, data: Partial<DriverPostingCreate>): Promise<DriverPostingResponse> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update Driver posting record');
    }
    postingCache = null; // Invalidate cache
    return response.json();
};

export const bulkCreateDriverPostings = async (request: BulkDriverPostingCreateRequest): Promise<DriverPostingBulkUploadResponse> => {
    const response = await fetch(`${REQUEST_URL}/bulk`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(request),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (Array.isArray(errorData.detail)) {
            const messages = errorData.detail.map((err: any) => {
                const loc = err.loc ? err.loc.join('.') : 'unknown';
                return `${loc}: ${err.msg}`;
            });
            throw new Error(messages.join(' | '));
        }

        throw new Error(errorData.detail || 'Failed to bulk create Driver postings');
    }
    postingCache = null; // Invalidate cache
    return response.json();
};

export const deleteDriverPosting = async (id: string): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete Driver posting record');
    }
    postingCache = null; // Invalidate cache
};

export const bulkDeleteDriverPostings = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
        throw new Error('Failed to bulk delete Driver posting records');
    }
    postingCache = null; // Invalidate cache
};
