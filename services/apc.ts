import { APCRecord, APCListResponse, APCCreate, APCUpdate } from '../types/apc';

import { API_BASE_URL } from '../src/config';

const REQUEST_URL = `${API_BASE_URL}/apc`;

export const getAllAPC = async (
    skip: number = 0,
    limit: number = 100,
    search: string = ''
): Promise<APCListResponse> => {
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });

    if (search) {
        params.append('search', search);
    }

    const response = await fetch(`${REQUEST_URL}?${params.toString()}`);
    if (!response.ok) {
        throw new Error('Failed to fetch APC records');
    }
    return response.json();
};

export const createAPC = async (data: APCCreate): Promise<APCRecord> => {
    const response = await fetch(REQUEST_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create APC record');
    }
    return response.json();
};

export const updateAPC = async (id: string, data: APCUpdate): Promise<APCRecord> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update APC record');
    }
    return response.json();
};

export const deleteAPC = async (id: string): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete APC record');
    }
};

export const bulkDeleteAPC = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/bulk-delete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
        throw new Error('Failed to bulk delete APC records');
    }
};

export const uploadAPC = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${REQUEST_URL}/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Failed to upload APC CSV');
    }
    return response.json();
};

export const getAllAPCRecords = async (): Promise<APCRecord[]> => {
    const response = await fetch(`${REQUEST_URL}?limit=100000`);
    if (!response.ok) {
        throw new Error('Failed to fetch all APC records');
    }
    const data: APCListResponse = await response.json();
    return data.items;
};
