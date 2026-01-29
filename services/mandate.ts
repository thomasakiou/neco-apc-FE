import { Mandate, MandateCreate, MandateUpdate, MandateListResponse, BulkUploadResponse } from '../types/mandate';

import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const API_URL = `${API_BASE_URL}/mandates`;

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let mandateCache: { data: Mandate[], timestamp: number } | null = null;

const invalidateCache = () => {
    mandateCache = null;
};

export const getMandateList = async (page: number = 1, limit: number = 10, search: string = ''): Promise<MandateListResponse> => {
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
    if (!response.ok) throw new Error('Failed to fetch mandates');
    return response.json();
};

export const getAllMandates = async (onlyActive: boolean = false, force: boolean = false): Promise<Mandate[]> => {
    if (!force && mandateCache && (Date.now() - mandateCache.timestamp < CACHE_TTL)) {
        return onlyActive ? mandateCache.data.filter(m => m.active) : mandateCache.data;
    }

    const response = await fetch(`${API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch all mandates');
    const data = await response.json();
    mandateCache = { data: data.items, timestamp: Date.now() };
    return onlyActive ? data.items.filter((m: Mandate) => m.active) : data.items;
};

export const getMandateById = async (id: string): Promise<Mandate> => {
    const response = await fetch(`${API_URL}/${id}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch mandate');
    return response.json();
};

export const createMandate = async (data: MandateCreate): Promise<Mandate> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create mandate');
    invalidateCache();
    return response.json();
};

export const updateMandate = async (id: string, data: MandateUpdate): Promise<Mandate> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update mandate');
    invalidateCache();
    return response.json();
};

export const deleteMandate = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete mandate');
    invalidateCache();
};

export const bulkDeleteMandates = async (ids: string[]): Promise<void> => {
    await Promise.all(ids.map(id => deleteMandate(id)));
    invalidateCache();
};

export const uploadMandateCsv = async (file: File): Promise<BulkUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) throw new Error('Failed to upload CSV');
    invalidateCache();
    return response.json();
};
