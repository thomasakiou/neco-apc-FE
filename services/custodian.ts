import { CustodianListResponse, CustodianCreate, CustodianUpdate, Custodian } from '../types/custodian';

import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const API_URL = `${API_BASE_URL}/custodians`;

export const getCustodianList = async (page: number = 1, limit: number = 10, search: string = '', stateId?: string): Promise<CustodianListResponse> => {
    const skip = (page - 1) * limit;
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });
    if (search) {
        params.append('search', search);
    }
    if (stateId) {
        params.append('state_id', stateId);
    }

    const response = await fetch(`${API_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch custodian list');
    }
    return response.json();
};

export const createCustodian = async (data: CustodianCreate): Promise<Custodian> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create custodian');
    }
    return response.json();
};

export const updateCustodian = async (id: string, data: CustodianUpdate): Promise<Custodian> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update custodian');
    }
    return response.json();
};

export const deleteCustodian = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete custodian');
    }
};

export const uploadCustodianCsv = async (file: File): Promise<any> => {
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
        throw new Error(errorData.detail || 'Failed to upload custodian CSV');
    }
    return response.json();
}

export const getAllCustodians = async (): Promise<Custodian[]> => {
    const response = await fetch(`${API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all custodians');
    }
    const data: CustodianListResponse = await response.json();
    return data.items;
};

export const bulkDeleteCustodians = async (ids: string[]): Promise<void> => {
    const deletePromises = ids.map(id => deleteCustodian(id));
    await Promise.all(deletePromises);
};
