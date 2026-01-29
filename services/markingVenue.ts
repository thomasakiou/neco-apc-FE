import { MarkingVenueListResponse, MarkingVenueCreate, MarkingVenueUpdate, MarkingVenue } from '../types/markingVenue';

import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const API_URL = `${API_BASE_URL}/marking-venues`;
const SSCE_EXT_API_URL = `${API_BASE_URL}/ssce-ext-marking-venues`;
const BECE_API_URL = `${API_BASE_URL}/bece-marking-venues`;

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export const getMarkingVenueList = async (page: number = 1, limit: number = 10, search: string = '', state?: string): Promise<MarkingVenueListResponse> => {
    const skip = (page - 1) * limit;
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });
    if (search) {
        params.append('search', search);
    }
    if (state) {
        params.append('state', state);
    }

    const response = await fetch(`${API_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch marking venue list');
    }
    return response.json();
};

// Caches
let venueCache: { data: MarkingVenue[], timestamp: number } | null = null;
let ssceExtVenueCache: { data: any[], timestamp: number } | null = null;
let beceVenueCache: { data: any[], timestamp: number } | null = null;

export const createMarkingVenue = async (data: MarkingVenueCreate): Promise<MarkingVenue> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create marking venue');
    }
    venueCache = null; // Invalidate
    return response.json();
};

export const updateMarkingVenue = async (id: string, data: MarkingVenueUpdate): Promise<MarkingVenue> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update marking venue');
    }
    venueCache = null; // Invalidate
    return response.json();
};

export const deleteMarkingVenue = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete marking venue');
    }
    venueCache = null; // Invalidate
};

export const uploadMarkingVenueCsv = async (file: File): Promise<any> => {
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
        throw new Error(errorData.detail || 'Failed to upload marking venue CSV');
    }
    venueCache = null; // Invalidate
    return response.json();
}

export const getAllMarkingVenues = async (onlyActive: boolean = false, force: boolean = false): Promise<MarkingVenue[]> => {
    if (!force && venueCache && (Date.now() - venueCache.timestamp < CACHE_TTL)) {
        return onlyActive ? venueCache.data.filter(v => v.active) : venueCache.data;
    }

    const response = await fetch(`${API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all marking venues');
    }
    const data: MarkingVenueListResponse = await response.json();
    venueCache = { data: data.items, timestamp: Date.now() };
    return onlyActive ? data.items.filter(v => v.active) : data.items;
};

export const bulkDeleteMarkingVenues = async (ids: string[]): Promise<void> => {
    const deletePromises = ids.map(id => deleteMarkingVenue(id));
    await Promise.all(deletePromises);
    venueCache = null; // Invalidate
};

// --- SSCE EXT Marking Venues ---
export const getSSCEExtMarkingVenueList = async (page: number = 1, limit: number = 10, search: string = '', state?: string): Promise<any> => {
    const skip = (page - 1) * limit;
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    if (search) params.append('search', search);
    if (state) params.append('state', state);
    const response = await fetch(`${SSCE_EXT_API_URL}?${params.toString()}`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch SSCE EXT marking venue list');
    return response.json();
};

export const createSSCEExtMarkingVenue = async (data: any): Promise<any> => {
    const response = await fetch(SSCE_EXT_API_URL, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data) });
    if (!response.ok) throw new Error('Failed to create SSCE EXT marking venue');
    ssceExtVenueCache = null; // Invalidate
    return response.json();
};

export const updateSSCEExtMarkingVenue = async (id: string, data: any): Promise<any> => {
    const response = await fetch(`${SSCE_EXT_API_URL}/${id}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data) });
    if (!response.ok) throw new Error('Failed to update SSCE EXT marking venue');
    ssceExtVenueCache = null; // Invalidate
    return response.json();
};

export const deleteSSCEExtMarkingVenue = async (id: string): Promise<void> => {
    const response = await fetch(`${SSCE_EXT_API_URL}/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to delete SSCE EXT marking venue');
    ssceExtVenueCache = null; // Invalidate
};

export const uploadSSCEExtMarkingVenueCsv = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${SSCE_EXT_API_URL}/upload`, { method: 'POST', headers: getAuthHeadersFormData(), body: formData });
    if (!response.ok) throw new Error('Failed to upload SSCE EXT marking venue CSV');
    ssceExtVenueCache = null; // Invalidate
    return response.json();
};

export const getAllSSCEExtMarkingVenues = async (onlyActive: boolean = false, force: boolean = false): Promise<any[]> => {
    if (!force && ssceExtVenueCache && (Date.now() - ssceExtVenueCache.timestamp < CACHE_TTL)) {
        return onlyActive ? ssceExtVenueCache.data.filter((v: any) => v.active) : ssceExtVenueCache.data;
    }

    const response = await fetch(`${SSCE_EXT_API_URL}?limit=10000`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch all SSCE EXT marking venues');
    const data = await response.json();
    ssceExtVenueCache = { data: data.items, timestamp: Date.now() };
    return onlyActive ? data.items.filter((v: any) => v.active) : data.items;
};

// --- BECE Marking Venues ---
export const getBECEMarkingVenueList = async (page: number = 1, limit: number = 10, search: string = '', state?: string): Promise<any> => {
    const skip = (page - 1) * limit;
    const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
    if (search) params.append('search', search);
    if (state) params.append('state', state);
    const response = await fetch(`${BECE_API_URL}?${params.toString()}`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch BECE marking venue list');
    return response.json();
};

export const createBECEMarkingVenue = async (data: any): Promise<any> => {
    const response = await fetch(BECE_API_URL, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data) });
    if (!response.ok) throw new Error('Failed to create BECE marking venue');
    beceVenueCache = null; // Invalidate
    return response.json();
};

export const updateBECEMarkingVenue = async (id: string, data: any): Promise<any> => {
    const response = await fetch(`${BECE_API_URL}/${id}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data) });
    if (!response.ok) throw new Error('Failed to update BECE marking venue');
    beceVenueCache = null; // Invalidate
    return response.json();
};

export const deleteBECEMarkingVenue = async (id: string): Promise<void> => {
    const response = await fetch(`${BECE_API_URL}/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to delete BECE marking venue');
    beceVenueCache = null; // Invalidate
};

export const uploadBECEMarkingVenueCsv = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${BECE_API_URL}/upload`, { method: 'POST', headers: getAuthHeadersFormData(), body: formData });
    if (!response.ok) throw new Error('Failed to upload BECE marking venue CSV');
    beceVenueCache = null; // Invalidate
    return response.json();
};

export const getAllBECEMarkingVenues = async (onlyActive: boolean = false, force: boolean = false): Promise<any[]> => {
    if (!force && beceVenueCache && (Date.now() - beceVenueCache.timestamp < CACHE_TTL)) {
        return onlyActive ? beceVenueCache.data.filter((v: any) => v.active) : beceVenueCache.data;
    }

    const response = await fetch(`${BECE_API_URL}?limit=10000`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch all BECE marking venues');
    const data = await response.json();
    beceVenueCache = { data: data.items, timestamp: Date.now() };
    return onlyActive ? data.items.filter((v: any) => v.active) : data.items;
};
