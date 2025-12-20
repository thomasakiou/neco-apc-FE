import { Mandate, MandateCreate, MandateUpdate, MandateListResponse, BulkUploadResponse } from '../types/mandate';

const API_BASE_URL = '/api/mandates';

export const getMandateList = async (page: number = 1, limit: number = 10, search: string = ''): Promise<MandateListResponse> => {
    const skip = (page - 1) * limit;
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });

    if (search) {
        params.append('search', search);
    }

    const response = await fetch(`${API_BASE_URL}?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch mandates');
    return response.json();
};

// Cache
let mandateCache: Mandate[] | null = null;

export const getAllMandates = async (): Promise<Mandate[]> => {
    if (mandateCache) return mandateCache;

    const response = await fetch(`${API_BASE_URL}?limit=10000`);
    if (!response.ok) throw new Error('Failed to fetch all mandates');
    const data = await response.json();
    mandateCache = data.items;
    return data.items;
};

export const getMandateById = async (id: string): Promise<Mandate> => {
    const response = await fetch(`${API_BASE_URL}/${id}`);
    if (!response.ok) throw new Error('Failed to fetch mandate');
    return response.json();
};

export const createMandate = async (data: MandateCreate): Promise<Mandate> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create mandate');
    mandateCache = null; // Invalidate
    return response.json();
};

export const updateMandate = async (id: string, data: MandateUpdate): Promise<Mandate> => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update mandate');
    mandateCache = null; // Invalidate
    return response.json();
};

export const deleteMandate = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete mandate');
    mandateCache = null; // Invalidate
};

export const bulkDeleteMandates = async (ids: string[]): Promise<void> => {
    await Promise.all(ids.map(id => deleteMandate(id)));
    mandateCache = null; // Invalidate
};

export const uploadMandateCsv = async (file: File): Promise<BulkUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) throw new Error('Failed to upload CSV');
    mandateCache = null; // Invalidate
    return response.json();
};
