import { API_BASE_URL as API_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';
import {
    HODFinalPostingResponse,
    HODFinalPostingCreate,
    HODFinalPostingUpdate,
    HODFinalPostingListResponse,
    HODFinalPostingBulkUploadResponse,
    BulkHODFinalPostingCreateRequest
} from '../types/hodFinalPosting';

const ENDPOINT = `${API_URL}/hod-final-posting`;

export const getAllHODFinalPostings = async (skip = 0, limit = 100000): Promise<HODFinalPostingListResponse> => {
    const response = await fetch(`${ENDPOINT}?skip=${skip}&limit=${limit}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch HOD final postings');
    return response.json();
};

export const getHODFinalPostingById = async (id: string): Promise<HODFinalPostingResponse> => {
    const response = await fetch(`${ENDPOINT}/${id}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch HOD final posting');
    return response.json();
};

export const createHODFinalPosting = async (data: HODFinalPostingCreate): Promise<HODFinalPostingResponse> => {
    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create HOD final posting');
    return response.json();
};

export const updateHODFinalPosting = async (id: string, data: HODFinalPostingUpdate): Promise<HODFinalPostingResponse> => {
    const response = await fetch(`${ENDPOINT}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update HOD final posting');
    return response.json();
};

export const deleteHODFinalPosting = async (id: string): Promise<void> => {
    const response = await fetch(`${ENDPOINT}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete HOD final posting');
};

export const bulkDeleteHODFinalPostings = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${ENDPOINT}/bulk-delete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
        },
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) throw new Error('Failed to bulk delete HOD final postings');
};

export const deleteAllHODFinalPostings = async (): Promise<void> => {
    const response = await fetch(`${ENDPOINT}/all`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete all HOD final postings');
};

export const uploadHODFinalPostings = async (file: File): Promise<HODFinalPostingBulkUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${ENDPOINT}/upload`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) throw new Error('Failed to upload HOD final postings');
    return response.json();
};

export const archiveHODFinalPostings = async (): Promise<HODFinalPostingBulkUploadResponse> => {
    const response = await fetch(`${ENDPOINT}/archive`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error('Failed to archive HOD final postings');
    return response.json();
};
