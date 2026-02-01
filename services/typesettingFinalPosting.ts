import { TypesettingPostingResponse, TypesettingPostingListResponse } from '../types/typesettingPosting';
import { API_BASE_URL } from '../src/config';
import { getAuthHeaders } from './apiUtils';

const REQUEST_URL = `${API_BASE_URL}/final-typsetting-posting`;

export const getAllTypesettingFinalPostings = async (skip: number = 0, limit: number = 100): Promise<TypesettingPostingListResponse> => {
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });

    const response = await fetch(`${REQUEST_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error('Failed to fetch Final Typesetting posting records');
    }

    return response.json();
};

export const bulkDeleteTypesettingFinalPostings = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
        throw new Error('Failed to bulk delete Final Typesetting posting records');
    }
};

export const deleteAllTypesettingFinalPostings = async (): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/all`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error('Failed to delete all Final Typesetting posting records');
    }
};

export const archiveTypesettingFinalPostings = async (): Promise<any> => {
    const response = await fetch(`${REQUEST_URL}/archive`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error('Failed to archive Typesetting postings');
    return response.json();
};
