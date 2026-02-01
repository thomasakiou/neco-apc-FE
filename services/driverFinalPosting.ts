import { DriverPostingResponse, DriverPostingListResponse } from '../types/driverPosting';
import { API_BASE_URL } from '../src/config';
import { getAuthHeaders } from './apiUtils';

const REQUEST_URL = `${API_BASE_URL}/final-drivers-posting`;

export const getAllDriverFinalPostings = async (skip: number = 0, limit: number = 100): Promise<DriverPostingListResponse> => {
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });

    const response = await fetch(`${REQUEST_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error('Failed to fetch Final Driver posting records');
    }

    return response.json();
};

export const bulkDeleteDriverFinalPostings = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
        throw new Error('Failed to bulk delete Final Driver posting records');
    }
};

export const deleteAllDriverFinalPostings = async (): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/all`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error('Failed to delete all Final Driver posting records');
    }
};

export const archiveDriverFinalPostings = async (): Promise<any> => {
    const response = await fetch(`${REQUEST_URL}/archive`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error('Failed to archive Driver postings');
    return response.json();
};
