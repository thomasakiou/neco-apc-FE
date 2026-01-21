import { HODPostingResponse, HODPostingCreate, HODPostingListResponse, BulkHODPostingCreateRequest, HODPostingBulkUploadResponse } from '../types/hodPosting';
import { API_BASE_URL } from '../src/config';
import { getAuthHeaders } from './apiUtils';

const REQUEST_URL = `${API_BASE_URL}/hod-posting`;

let postingCache: HODPostingResponse[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getAllHODPostings = async (forceRefresh: boolean = false): Promise<HODPostingResponse[]> => {
    const now = Date.now();
    if (!forceRefresh && postingCache && (now - lastFetchTime) < CACHE_DURATION) {
        return postingCache;
    }

    const response = await fetch(`${REQUEST_URL}?limit=100000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch HOD posting records');
    }
    const data: HODPostingListResponse = await response.json();
    postingCache = data.items;
    lastFetchTime = now;
    return data.items;
};

export const getHODPostingById = async (id: string): Promise<HODPostingResponse> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch HOD posting record');
    }
    return response.json();
};

export const createHODPosting = async (data: HODPostingCreate): Promise<HODPostingResponse> => {
    const response = await fetch(REQUEST_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create HOD posting record');
    }
    postingCache = null; // Invalidate cache
    return response.json();
};

export const updateHODPosting = async (id: string, data: Partial<HODPostingCreate>): Promise<HODPostingResponse> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update HOD posting record');
    }
    postingCache = null; // Invalidate cache
    return response.json();
};

export const bulkCreateHODPostings = async (request: BulkHODPostingCreateRequest): Promise<HODPostingBulkUploadResponse> => {
    const response = await fetch(`${REQUEST_URL}/bulk`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(request),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle Pydantic validation errors which come in an 'detail' array
        if (Array.isArray(errorData.detail)) {
            const messages = errorData.detail.map((err: any) => {
                const loc = err.loc ? err.loc.join('.') : 'unknown';
                return `${loc}: ${err.msg}`;
            });
            throw new Error(messages.join(' | '));
        }

        throw new Error(errorData.detail || 'Failed to bulk create HOD postings');
    }
    postingCache = null; // Invalidate cache
    return response.json();
};

export const deleteHODPosting = async (id: string): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete HOD posting record');
    }
    postingCache = null; // Invalidate cache
};

export const bulkDeleteHODPostings = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
        throw new Error('Failed to bulk delete HOD posting records');
    }
    postingCache = null; // Invalidate cache
};
