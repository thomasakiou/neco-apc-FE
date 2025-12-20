import { Assignment, AssignmentCreate, AssignmentUpdate, AssignmentListResponse, AssignmentBulkUploadResponse } from '../types/assignment';

import { API_BASE_URL as BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const API_URL = `${BASE_URL}/assignments`;

export const getAssignments = async (skip = 0, limit = 100, search = ''): Promise<AssignmentListResponse> => {
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });
    if (search) params.append('search', search);

    const response = await fetch(`${API_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch assignments');
    return response.json();
};

// Cache
let assignmentCache: Assignment[] | null = null;

export const getAllAssignments = async (onlyActive: boolean = false): Promise<Assignment[]> => {
    if (assignmentCache) {
        return onlyActive ? assignmentCache.filter(a => a.active) : assignmentCache;
    }

    const response = await fetch(`${API_URL}?skip=0&limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch all assignments');
    const data: AssignmentListResponse = await response.json();

    assignmentCache = data.items;
    return onlyActive ? data.items.filter(a => a.active) : data.items;
};

export const getMandatesByAssignment = async (assignmentObj: any): Promise<any[]> => {
    if (!assignmentObj.mandates || assignmentObj.mandates.length === 0) {
        return [];
    }
    const response = await fetch(`/api/mandates?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch mandates');
    const data = await response.json();

    // Filter mandates that are in the assignment's mandates array
    return data.items.filter((mandate: any) =>
        assignmentObj.mandates.includes(mandate.code)
    );
};

export const createAssignment = async (data: AssignmentCreate): Promise<Assignment> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.[0]?.msg || 'Failed to create assignment');
    }
    assignmentCache = null; // Invalidate
    return response.json();
};

export const updateAssignment = async (id: string, data: AssignmentUpdate): Promise<Assignment> => {
    console.log('Updating assignment with data:', data);
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json();
        console.error('Update assignment error:', errorData);
        throw new Error('Failed to update assignment');
    }
    assignmentCache = null; // Invalidate
    return response.json();
};

export const deleteAssignment = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete assignment');
    assignmentCache = null; // Invalidate
};

export const deleteAssignments = async (): Promise<void> => {
    const response = await fetch(`${API_URL}/all`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete all assignments');
    assignmentCache = null; // Invalidate
};

export const uploadAssignments = async (file: File): Promise<AssignmentBulkUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.[0]?.msg || 'Failed to upload assignments');
    }
    assignmentCache = null; // Invalidate
    return response.json();
};
