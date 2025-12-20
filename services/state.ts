import { StateListResponse, StateCreate, StateUpdate, State, MarkingVenue, Custodian, School } from '../types/state';

import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const API_URL = `${API_BASE_URL}/states`;

let allStatesCache: State[] | null = null;
export const clearStateCache = () => { allStatesCache = null; };


export const getStateList = async (page: number = 1, limit: number = 10, search: string = ''): Promise<StateListResponse> => {
    const skip = (page - 1) * limit;
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });
    if (search) {
        params.append('search', search);
    }

    const response = await fetch(`${API_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch state list');
    }
    return response.json();
};

export const createState = async (data: StateCreate): Promise<State> => {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create state');
    }
    clearStateCache();
    return response.json();
};

export const updateState = async (id: string, data: StateUpdate): Promise<State> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update state');
    }
    clearStateCache();
    return response.json();
};

export const deleteState = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete state');
    }
    clearStateCache();
};

export const uploadStateCsv = async (file: File): Promise<any> => {
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
        throw new Error(errorData.detail || 'Failed to upload state CSV');
    }
    return response.json();
}

export const getAllStates = async (): Promise<State[]> => {
    if (allStatesCache) return allStatesCache;
    const response = await fetch(`${API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all states');
    }
    const data: StateListResponse = await response.json();
    allStatesCache = data.items;
    return allStatesCache;
};

export const bulkDeleteStates = async (ids: string[]): Promise<void> => {
    const deletePromises = ids.map(id => deleteState(id));
    await Promise.all(deletePromises);
};

// Related entities services
export const getMarkingVenuesByState = async (stateName: string): Promise<MarkingVenue[]> => {
    const response = await fetch(`${API_BASE_URL}/marking-venues?state=${encodeURIComponent(stateName)}&limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch marking venues');
    }
    const data = await response.json();
    return data.items;
};

export const getCustodiansByState = async (stateId: string): Promise<Custodian[]> => {
    const response = await fetch(`${API_BASE_URL}/custodians?state_id=${stateId}&limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch custodians');
    }
    const data = await response.json();
    return data.items;
};

export const getSchoolsByState = async (stateId: string): Promise<School[]> => {
    const response = await fetch(`${API_BASE_URL}/schools?state_id=${stateId}&limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch schools');
    }
    const data = await response.json();
    return data.items;
};

// New state-specific custodian endpoints
export const getSSCECustodiansByState = async (stateName: string): Promise<any[]> => {
    const response = await fetch(`${API_URL}/${encodeURIComponent(stateName)}/ssce-custodians`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch SSCE custodians');
    }
    return response.json();
};

export const getBECECustodiansByState = async (stateName: string): Promise<any[]> => {
    const response = await fetch(`${API_URL}/${encodeURIComponent(stateName)}/bece-custodians`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch BECE custodians');
    }
    return response.json();
};

// Additional state-specific endpoints
export const getMarkingVenuesByStateName = async (stateName: string): Promise<any[]> => {
    const response = await fetch(`${API_URL}/${encodeURIComponent(stateName)}/marking-venues`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch marking venues');
    }
    return response.json();
};

export const getSchoolsByStateName = async (stateName: string): Promise<any[]> => {
    const response = await fetch(`${API_URL}/${encodeURIComponent(stateName)}/schools`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch schools');
    }
    return response.json();
};

export const getNCEECentersByStateName = async (stateName: string): Promise<any[]> => {
    const response = await fetch(`${API_URL}/${encodeURIComponent(stateName)}/ncee-centers`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch NCEE centers');
    }
    return response.json();
};
