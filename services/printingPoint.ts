import { PrintingPoint, PrintingPointCreate, PrintingPointUpdate, PrintingPointListResponse, PrintingPointBulkUploadResponse } from '../types/printingPoint';
import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const API_URL = `${API_BASE_URL}/printing-points`;

export const getPrintingPoints = async (skip = 0, limit = 100000): Promise<PrintingPointListResponse> => {
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });

    const response = await fetch(`${API_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch Printing Points');
    return response.json();
};

export const getAllPrintingPoints = async (onlyActive: boolean = false): Promise<PrintingPoint[]> => {
    const response = await fetch(`${API_URL}?skip=0&limit=100000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch all Printing Points');
    const data: PrintingPointListResponse = await response.json();
    return onlyActive ? data.items.filter(item => item.status === 'Active') : data.items;
};

export const getPrintingPointById = async (id: string): Promise<PrintingPoint> => {
    const response = await fetch(`${API_URL}/${id}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch Printing Point');
    return response.json();
};

export const createPrintingPoint = async (data: PrintingPointCreate): Promise<PrintingPoint> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create Printing Point');
    return response.json();
};

export const updatePrintingPoint = async (id: string, data: PrintingPointUpdate): Promise<PrintingPoint> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update Printing Point');
    return response.json();
};

export const deletePrintingPoint = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete Printing Point');
};

export const deleteAllPrintingPoints = async (): Promise<void> => {
    const response = await fetch(`${API_URL}/all`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete all Printing Points');
    }
};

export const uploadPrintingPoints = async (file: File): Promise<PrintingPointBulkUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) throw new Error('Failed to upload Printing Points');
    return response.json();
};
