import { TypesettingPostingResponse, TypesettingPostingCreate, TypesettingPostingListResponse, BulkTypesettingPostingCreateRequest, TypesettingPostingBulkUploadResponse } from '../types/typesettingPosting';
import { API_BASE_URL } from '../src/config';
import { getAuthHeaders } from './apiUtils';

const REQUEST_URL = `${API_BASE_URL}/typsetting-posting`;

let postingCache: TypesettingPostingResponse[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getAllTypesettingPostings = async (forceRefresh: boolean = false): Promise<TypesettingPostingResponse[]> => {
    const now = Date.now();
    if (!forceRefresh && postingCache && (now - lastFetchTime) < CACHE_DURATION) {
        return postingCache;
    }

    const response = await fetch(`${REQUEST_URL}?limit=100000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch Typesetting posting records');
    }
    const data: TypesettingPostingListResponse = await response.json();
    postingCache = data.items;
    lastFetchTime = now;
    return data.items;
};

export const getTypesettingPostingById = async (id: string): Promise<TypesettingPostingResponse> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch Typesetting posting record');
    }
    return response.json();
};

export const createTypesettingPosting = async (data: TypesettingPostingCreate): Promise<TypesettingPostingResponse> => {
    const response = await fetch(REQUEST_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create Typesetting posting record');
    }
    postingCache = null; // Invalidate cache
    return response.json();
};

export const updateTypesettingPosting = async (id: string, data: Partial<TypesettingPostingCreate>): Promise<TypesettingPostingResponse> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update Typesetting posting record');
    }
    postingCache = null; // Invalidate cache
    return response.json();
};

export const bulkCreateTypesettingPostings = async (request: BulkTypesettingPostingCreateRequest): Promise<TypesettingPostingBulkUploadResponse> => {
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

        throw new Error(errorData.detail || 'Failed to bulk create Typesetting postings');
    }
    postingCache = null; // Invalidate cache
    return response.json();
};

export const deleteTypesettingPosting = async (id: string): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete Typesetting posting record');
    }
    postingCache = null; // Invalidate cache
};

export const bulkDeleteTypesettingPostings = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
        throw new Error('Failed to bulk delete Typesetting posting records');
    }
    postingCache = null; // Invalidate cache
};
