import { ArchiveRecord, ArchiveCreate, ArchiveUpdate, ArchiveListResponse } from '../types/archive';
import { API_BASE_URL } from '../src/config';
import { getAuthHeaders } from './apiUtils';

const REQUEST_URL = `${API_BASE_URL}/archives`;

// Cache
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let archivesCache: { data: ArchiveRecord[], timestamp: number } | null = null;

export const getAllArchives = async (
    skip: number = 0,
    limit: number = 100,
    force: boolean = false
): Promise<ArchiveListResponse> => {
    // Return all from cache if possible
    if (!force && skip === 0 && limit >= 10000 && archivesCache && (Date.now() - archivesCache.timestamp < CACHE_TTL)) {
        return {
            items: archivesCache.data,
            total: archivesCache.data.length,
            skip,
            limit
        };
    }

    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });

    const response = await fetch(`${REQUEST_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch archive records');
    }
    const data: ArchiveListResponse = await response.json();

    // Cache the full list if we fetched a large amount
    if (skip === 0 && limit >= 10000) {
        archivesCache = { data: data.items, timestamp: Date.now() };
    }

    return data;
};

export const createArchive = async (data: ArchiveCreate): Promise<ArchiveRecord> => {
    const response = await fetch(REQUEST_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Create Archive Error:', response.status, errorData);
        throw new Error(errorData.detail ? (typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail)) : 'Failed to create archive');
    }
    archivesCache = null; // Invalidate
    return response.json();
};

export const updateArchive = async (id: string, data: ArchiveUpdate): Promise<ArchiveRecord> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail ? (typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail)) : 'Failed to update archive record');
    }
    archivesCache = null; // Invalidate
    return response.json();
};

export const deleteArchive = async (id: string): Promise<void> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete archive record');
    }
    archivesCache = null; // Invalidate
};

export const getArchiveById = async (id: string): Promise<ArchiveRecord> => {
    const response = await fetch(`${REQUEST_URL}/${id}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch archive record');
    }
    return response.json();
};
