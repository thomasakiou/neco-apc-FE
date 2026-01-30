import { getAuthHeaders } from './apiUtils';
import { API_BASE_URL } from '../src/config';
import { FinalPostingListResponse, FinalPostingBulkUploadResponse, FinalPostingResponse } from '../types/finalPosting';

const BASE_URL = `${API_BASE_URL}/final-posting`;

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let finalPostingCache: { data: FinalPostingListResponse, timestamp: number } | null = null;

export const getAllFinalPostings = async (
    skip: number = 0,
    limit: number = 100000, // Large limit by default as per other services
    force: boolean = false
): Promise<FinalPostingListResponse> => {
    // Basic caching strategy
    if (!force && finalPostingCache && (Date.now() - finalPostingCache.timestamp < CACHE_TTL) && skip === 0) {
        return finalPostingCache.data;
    }

    const response = await fetch(`${BASE_URL}?skip=${skip}&limit=${limit}`, {
        headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('Failed to fetch final postings');

    const data = await response.json();
    if (skip === 0) finalPostingCache = { data, timestamp: Date.now() };
    return data;
};

export const archivePostings = async (): Promise<FinalPostingBulkUploadResponse> => {
    const response = await fetch(`${BASE_URL}/archive`, {
        method: 'POST',
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to archive postings');
    }

    // Invalidate cache
    finalPostingCache = null;

    return response.json();
};

export const deleteAllFinalPostings = async (): Promise<any> => {
    const response = await fetch(`${BASE_URL}/all`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = typeof errorData.detail === 'object'
            ? JSON.stringify(errorData.detail)
            : (errorData.detail || 'Failed to delete all final postings');
        throw new Error(errorMessage);
    }

    // Invalidate cache
    finalPostingCache = null;

    return response.json();
};

export const bulkDeleteFinalPostings = async (ids: string[]): Promise<any> => {
    const response = await fetch(`${BASE_URL}/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = typeof errorData.detail === 'object'
            ? JSON.stringify(errorData.detail)
            : (errorData.detail || 'Failed to delete selected final postings');
        throw new Error(errorMessage);
    }

    // Invalidate cache
    finalPostingCache = null;

    return response.json();
};

export const updateFinalPosting = async (id: string, payload: any): Promise<FinalPostingResponse> => {
    const response = await fetch(`${BASE_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to update final posting');
    }

    // Invalidate cache
    finalPostingCache = null;

    return response.json();
};

// Function to clear cache if needed externally
export const clearFinalPostingCache = () => {
    finalPostingCache = null;
};
