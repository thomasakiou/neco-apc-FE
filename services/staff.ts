import { StaffListResponse, StaffCreate, StaffUpdate, Staff } from '../types/staff';

const API_BASE_URL = '/api/staff';

export const getStaffList = async (page: number = 1, limit: number = 10, search: string = ''): Promise<StaffListResponse> => {
    const skip = (page - 1) * limit;
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });
    if (search) {
        params.append('search', search);
    }

    const response = await fetch(`${API_BASE_URL}?${params.toString()}`);
    if (!response.ok) {
        throw new Error('Failed to fetch staff list');
    }
    return response.json();
};

export const createStaff = async (data: StaffCreate): Promise<Staff> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create staff');
    }
    return response.json();
};

export const updateStaff = async (id: string, data: StaffUpdate): Promise<Staff> => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update staff');
    }
    return response.json();
};

export const deleteStaff = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete staff');
    }
};

export const uploadStaffCsv = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
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
    const response = await fetch(`${API_BASE_URL}?limit=10000`);
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
    const response = await fetch(`${API_BASE_URL}/bulk-delete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
        throw new Error('Failed to bulk delete staff records');
    }
};

