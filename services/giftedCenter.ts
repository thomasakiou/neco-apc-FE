import { GiftedCenter, GiftedCenterCreate, GiftedCenterUpdate, GiftedCenterListResponse, GiftedCenterBulkUploadResponse } from '../types/giftedCenter';

import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const API_URL = `${API_BASE_URL}/gifted-centers`;

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let centerCache: { data: GiftedCenter[], timestamp: number } | null = null;

const invalidateCache = () => {
    centerCache = null;
};

export const getGiftedCenters = async (skip = 0, limit = 100000): Promise<GiftedCenterListResponse> => {
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });

    const response = await fetch(`${API_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch Gifted centers');
    return response.json();
};

export const getAllGiftedCenters = async (onlyActive: boolean = false, force: boolean = false): Promise<GiftedCenter[]> => {
    if (!force && centerCache && (Date.now() - centerCache.timestamp < CACHE_TTL)) {
        return onlyActive ? centerCache.data.filter(item => item.active) : centerCache.data;
    }

    const response = await fetch(`${API_URL}?skip=0&limit=100000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch all Gifted centers');
    const data: GiftedCenterListResponse = await response.json();

    centerCache = { data: data.items, timestamp: Date.now() };
    return onlyActive ? data.items.filter(item => item.active) : data.items;
};

export const getGiftedCenterById = async (id: string): Promise<GiftedCenter> => {
    const response = await fetch(`${API_URL}/${id}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch Gifted center');
    return response.json();
};

export const createGiftedCenter = async (data: GiftedCenterCreate): Promise<GiftedCenter> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create Gifted center');
    invalidateCache();
    return response.json();
};

export const updateGiftedCenter = async (id: string, data: GiftedCenterUpdate): Promise<GiftedCenter> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update Gifted center');
    invalidateCache();
    return response.json();
};

export const deleteGiftedCenter = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete Gifted center');
    invalidateCache();
};

export const deleteAllGiftedCenters = async (): Promise<void> => {
    const response = await fetch(`${API_URL}/all`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete all Gifted centers');
    }
    invalidateCache();
};

export const uploadGiftedCenters = async (file: File): Promise<GiftedCenterBulkUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) throw new Error('Failed to upload Gifted centers');
    invalidateCache();
    return response.json();
};
