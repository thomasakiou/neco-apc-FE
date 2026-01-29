import { TTCenter, TTCenterCreate, TTCenterUpdate, TTCenterListResponse, TTCenterBulkUploadResponse } from '../types/ttCenter';
import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const API_URL = `${API_BASE_URL}/tt-centers`;

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let centerCache: { data: TTCenter[], timestamp: number } | null = null;

const invalidateCache = () => {
    centerCache = null;
};

export const getTTCenters = async (skip = 0, limit = 100000): Promise<TTCenterListResponse> => {
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });

    const response = await fetch(`${API_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch TT centers');
    return response.json();
};

export const getAllTTCenters = async (onlyActive: boolean = false, force: boolean = false): Promise<TTCenter[]> => {
    if (!force && centerCache && (Date.now() - centerCache.timestamp < CACHE_TTL)) {
        return onlyActive ? centerCache.data.filter(item => item.active) : centerCache.data;
    }

    const response = await fetch(`${API_URL}?skip=0&limit=100000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch all TT centers');
    const data: TTCenterListResponse = await response.json();

    centerCache = { data: data.items, timestamp: Date.now() };
    return onlyActive ? data.items.filter(item => item.active) : data.items;
};

export const getTTCenterById = async (id: string): Promise<TTCenter> => {
    const response = await fetch(`${API_URL}/${id}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch TT center');
    return response.json();
};

export const createTTCenter = async (data: TTCenterCreate): Promise<TTCenter> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create TT center');
    invalidateCache();
    return response.json();
};

export const updateTTCenter = async (id: string, data: TTCenterUpdate): Promise<TTCenter> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update TT center');
    invalidateCache();
    return response.json();
};

export const deleteTTCenter = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete TT center');
    invalidateCache();
};

export const deleteAllTTCenters = async (): Promise<void> => {
    const response = await fetch(`${API_URL}/all`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete all TT centers');
    }
    invalidateCache();
};

export const uploadTTCenters = async (file: File): Promise<TTCenterBulkUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) throw new Error('Failed to upload TT centers');
    invalidateCache();
    return response.json();
};
