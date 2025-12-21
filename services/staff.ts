import { StaffListResponse, StaffCreate, StaffUpdate, Staff } from '../types/staff';

import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const API_URL = `${API_BASE_URL}/staff`;

export const getStaffList = async (page: number = 1, limit: number = 10, search: string = ''): Promise<StaffListResponse> => {
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
        throw new Error('Failed to fetch staff list');
    }
    return response.json();
};

const cleanPayload = (data: any) => {
    const cleaned = { ...data };
    const nullableFields = ['dob', 'dofa', 'doan', 'dopa', 'email', 'phone', 'station', 'qualification', 'rank', 'conr', 'state', 'lga', 'remark', 'sex'];

    nullableFields.forEach(field => {
        if (cleaned[field] === '') {
            cleaned[field] = null;
        }
    });

    // Ensure active is boolean as per schema
    if (cleaned.active !== undefined) {
        cleaned.active = Boolean(cleaned.active);
    }

    return cleaned;
};

export const createStaff = async (data: StaffCreate): Promise<Staff> => {
    const payload = cleanPayload(data);

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Create Staff Error:', response.status, errorData);
        throw new Error(errorData.detail ? JSON.stringify(errorData.detail) : 'Failed to create staff');
    }
    return response.json();
};

export const updateStaff = async (id: string, data: StaffUpdate): Promise<Staff> => {
    const payload = cleanPayload(data);

    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Update Staff Error:', response.status, errorData);
        throw new Error(errorData.detail ? JSON.stringify(errorData.detail) : 'Failed to update staff');
    }
    return response.json();
};

export const deleteStaff = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete staff');
    }
};

export const uploadStaffCsv = async (file: File): Promise<any> => {
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
        throw new Error(errorData.detail || 'Failed to upload staff CSV');
    }
    return response.json();
}

export const getAllStaff = async (onlyActive: boolean = false): Promise<Staff[]> => {
    const response = await fetch(`${API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all staff');
    }
    const data: StaffListResponse = await response.json();
    let items = data.items;
    if (onlyActive) {
        items = items.filter(item => item.active);
    }
    return items;
};

export const bulkDeleteStaff = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${API_URL}/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
        throw new Error('Failed to bulk delete staff records');
    }
};

