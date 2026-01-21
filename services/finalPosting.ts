import { getAuthHeaders } from './apiUtils';
import { API_BASE_URL } from '../src/config';
import { FinalPostingListResponse, FinalPostingBulkUploadResponse } from '../types/finalPosting';

const BASE_URL = `${API_BASE_URL}/final-posting`;

let finalPostingCache: FinalPostingListResponse | null = null;

export const getAllFinalPostings = async (
    skip: number = 0,
    limit: number = 100000 // Large limit by default as per other services
): Promise<FinalPostingListResponse> => {
    // Basic caching strategy
    if (finalPostingCache && skip === 0) {
        // You might want to remove cache logic if data changes frequently or add time-expiry
        // return finalPostingCache; 
    }

    const response = await fetch(`${BASE_URL}?skip=${skip}&limit=${limit}`, {
        headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('Failed to fetch final postings');

    const data = await response.json();
    if (skip === 0) finalPostingCache = data;
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

// Function to clear cache if needed externally
export const clearFinalPostingCache = () => {
    finalPostingCache = null;
};
