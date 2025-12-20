import { SchoolListResponse, SchoolCreate, SchoolUpdate, School } from '../types/school';

import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const API_URL = `${API_BASE_URL}/schools`;

export const getSchoolList = async (page: number = 1, limit: number = 10, search: string = '', stateId?: string): Promise<SchoolListResponse> => {
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
        throw new Error('Failed to fetch school list');
    }
    return response.json();
};

export const createSchool = async (data: SchoolCreate): Promise<School> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create school');
    }
    return response.json();
};

export const updateSchool = async (id: string, data: SchoolUpdate): Promise<School> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update school');
    }
    return response.json();
};

export const deleteSchool = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete school');
    }
};

export const uploadSchoolCsv = async (file: File): Promise<any> => {
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
        throw new Error(errorData.detail || 'Failed to upload school CSV');
    }
    return response.json();
}

export const getAllSchools = async (): Promise<School[]> => {
    const response = await fetch(`${API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all schools');
    }
    const data: SchoolListResponse = await response.json();
    return data.items;
};

export const bulkDeleteSchools = async (ids: string[]): Promise<void> => {
    const deletePromises = ids.map(id => deleteSchool(id));
    await Promise.all(deletePromises);
};
