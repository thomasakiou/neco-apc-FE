import { MarkingVenueListResponse, MarkingVenueCreate, MarkingVenueUpdate, MarkingVenue } from '../types/markingVenue';

import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const API_URL = `${API_BASE_URL}/marking-venues`;

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

// Cache
let venueCache: MarkingVenue[] | null = null;

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

export const getAllMarkingVenues = async (onlyActive: boolean = false): Promise<MarkingVenue[]> => {
    if (venueCache) {
        return onlyActive ? venueCache.filter(v => v.active) : venueCache;
    }

    const response = await fetch(`${API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all marking venues');
    }
    const data: MarkingVenueListResponse = await response.json();
    venueCache = data.items;
    return onlyActive ? data.items.filter(v => v.active) : data.items;
};

export const bulkDeleteMarkingVenues = async (ids: string[]): Promise<void> => {
    const deletePromises = ids.map(id => deleteMarkingVenue(id));
    await Promise.all(deletePromises);
    venueCache = null; // Invalidate
};
