import { NCEECenter, NCEECenterCreate, NCEECenterUpdate, NCEECenterListResponse, NCEECenterBulkUploadResponse } from '../types/nceeCenter';

import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const API_URL = `${API_BASE_URL}/ncee-centers`;

export const getNCEECenters = async (skip = 0, limit = 100000): Promise<NCEECenterListResponse> => {
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });

    const response = await fetch(`${API_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch NCEE centers');
    return response.json();
};

export const getAllNCEECenters = async (): Promise<NCEECenter[]> => {
    const response = await fetch(`${API_URL}?skip=0&limit=100000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch all NCEE centers');
    const data: NCEECenterListResponse = await response.json();
    return data.items;
};

export const getNCEECenterById = async (id: string): Promise<NCEECenter> => {
    const response = await fetch(`${API_URL}/${id}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch NCEE center');
    return response.json();
};

export const createNCEECenter = async (data: NCEECenterCreate): Promise<NCEECenter> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create NCEE center');
    return response.json();
};

export const updateNCEECenter = async (id: string, data: NCEECenterUpdate): Promise<NCEECenter> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update NCEE center');
    return response.json();
};

export const deleteNCEECenter = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete NCEE center');
};

export const deleteAllNCEECenters = async (): Promise<void> => {
    const response = await fetch(`${API_URL}/all`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete all NCEE centers');
    }
};

export const uploadNCEECenters = async (file: File): Promise<NCEECenterBulkUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) throw new Error('Failed to upload NCEE centers');
    return response.json();
};