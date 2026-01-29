import { StationListResponse, StationCreate, StationUpdate, Station } from '../types/station';

import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const API_URL = `${API_BASE_URL}/stations`;

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let stationCache: { data: Station[], timestamp: number } | null = null;

const invalidateCache = () => {
    stationCache = null;
};

export const getStationList = async (page: number = 1, limit: number = 10, search: string = ''): Promise<StationListResponse> => {
    const skip = (page - 1) * limit;
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });
    if (search) {
        params.append('search', search);
    }

    const response = await fetch(`${API_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch station list');
    }
    return response.json();
};

export const createStation = async (data: StationCreate): Promise<Station> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create station');
    }
    return response.json();
};

export const updateStation = async (id: string, data: StationUpdate): Promise<Station> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update station');
    }
    return response.json();
};

export const deleteStation = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete station');
    }
    invalidateCache();
};

export const uploadStationCsv = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Upload Error Details:', errorData);
        throw new Error(errorData.detail || 'Failed to upload station CSV');
    }
    invalidateCache();
    return response.json();
}

export const getAllStations = async (onlyActive: boolean = false, force: boolean = false): Promise<Station[]> => {
    if (!force && stationCache && (Date.now() - stationCache.timestamp < CACHE_TTL)) {
        return onlyActive ? stationCache.data.filter(s => s.active) : stationCache.data;
    }
    const response = await fetch(`${API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all stations');
    }
    const data: StationListResponse = await response.json();
    stationCache = { data: data.items, timestamp: Date.now() };
    return onlyActive ? data.items.filter(s => s.active) : data.items;
};

export const bulkDeleteStations = async (ids: string[]): Promise<void> => {
    // Use Promise.all for parallel deletion since there's no bulk delete endpoint
    const deletePromises = ids.map(id => deleteStation(id));
    await Promise.all(deletePromises);
};
