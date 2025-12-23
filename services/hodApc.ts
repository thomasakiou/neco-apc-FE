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
    return response.json();
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
    return response.json();
};

export const deleteHODApc = async (id: string): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete HOD APC record');
    }
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
};

export const getAllHODApcRecords = async (onlyActive: boolean = false): Promise<HODApcRecord[]> => {
    const response = await fetch(`${REQUEST_URL}?limit=100000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all HOD APC records');
    }
    const data: HODApcListResponse = await response.json();
    let items = data.items;
    if (onlyActive) {
        items = items.filter(item => item.active);
    }
    return items;
};
