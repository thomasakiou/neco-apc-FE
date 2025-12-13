import { StationListResponse, StationCreate, StationUpdate, Station } from '../types/station';

const API_BASE_URL = '/api/stations';

export const getStationList = async (page: number = 1, limit: number = 10, search: string = ''): Promise<StationListResponse> => {
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
        throw new Error('Failed to fetch station list');
    }
    return response.json();
};

export const createStation = async (data: StationCreate): Promise<Station> => {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create station');
    }
    return response.json();
};

export const updateStation = async (id: string, data: StationUpdate): Promise<Station> => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update station');
    }
    return response.json();
};

export const deleteStation = async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete station');
    }
};

export const uploadStationCsv = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Upload Error Details:', errorData);
        throw new Error(errorData.detail || 'Failed to upload station CSV');
    }
    return response.json();
}

export const getAllStations = async (): Promise<Station[]> => {
    const response = await fetch(`${API_BASE_URL}?limit=10000`);
    if (!response.ok) {
        throw new Error('Failed to fetch all stations');
    }
    const data: StationListResponse = await response.json();
    return data.items;
};

export const bulkDeleteStations = async (ids: string[]): Promise<void> => {
    // Use Promise.all for parallel deletion since there's no bulk delete endpoint
    const deletePromises = ids.map(id => deleteStation(id));
    await Promise.all(deletePromises);
};
