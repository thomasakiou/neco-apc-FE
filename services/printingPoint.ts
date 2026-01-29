import { PrintingPoint, PrintingPointCreate, PrintingPointUpdate, PrintingPointListResponse, PrintingPointBulkUploadResponse } from '../types/printingPoint';
import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const API_URL = `${API_BASE_URL}/printing-points`;

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let printingPointCache: { data: PrintingPoint[], timestamp: number } | null = null;

const invalidateCache = () => {
    printingPointCache = null;
};

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

export const getAllPrintingPoints = async (onlyActive: boolean = false, force: boolean = false): Promise<PrintingPoint[]> => {
    if (!force && printingPointCache && (Date.now() - printingPointCache.timestamp < CACHE_TTL)) {
        return onlyActive ? printingPointCache.data.filter(item => item.status === 'Active') : printingPointCache.data;
    }
    const response = await fetch(`${API_URL}?skip=0&limit=100000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch all Printing Points');
    const data: PrintingPointListResponse = await response.json();
    printingPointCache = { data: data.items, timestamp: Date.now() };
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
    invalidateCache();
    return response.json();
};

export const updatePrintingPoint = async (id: string, data: PrintingPointUpdate): Promise<PrintingPoint> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update Printing Point');
    invalidateCache();
    return response.json();
};

export const deletePrintingPoint = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete Printing Point');
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
    return response.json();
};
