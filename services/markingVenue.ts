import { MarkingVenueListResponse, MarkingVenueCreate, MarkingVenueUpdate, MarkingVenue } from '../types/markingVenue';

const API_BASE_URL = '/api/marking-venues';

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

    const response = await fetch(`${API_BASE_URL}?${params.toString()}`);
    if (!response.ok) {
        throw new Error('Failed to fetch marking venue list');
    }
    return response.json();
};

export const createMarkingVenue = async (data: MarkingVenueCreate): Promise<MarkingVenue> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create marking venue');
    }
    return response.json();
};

export const updateMarkingVenue = async (id: string, data: MarkingVenueUpdate): Promise<MarkingVenue> => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update marking venue');
    }
    return response.json();
};

export const deleteMarkingVenue = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete marking venue');
    }
};

export const uploadMarkingVenueCsv = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Upload Error Details:', errorData);
        throw new Error(errorData.detail || 'Failed to upload marking venue CSV');
    }
    return response.json();
}

export const getAllMarkingVenues = async (): Promise<MarkingVenue[]> => {
    const response = await fetch(`${API_BASE_URL}?limit=10000`);
    if (!response.ok) {
        throw new Error('Failed to fetch all marking venues');
    }
    const data: MarkingVenueListResponse = await response.json();
    return data.items;
};

export const bulkDeleteMarkingVenues = async (ids: string[]): Promise<void> => {
    const deletePromises = ids.map(id => deleteMarkingVenue(id));
    await Promise.all(deletePromises);
};
