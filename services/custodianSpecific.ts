import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const BECE_API_URL = `${API_BASE_URL}/bece-custodians`;
const SSCE_API_URL = `${API_BASE_URL}/ssce-custodians`;
const SSCE_EXT_API_URL = `${API_BASE_URL}/ssce-ext-custodians`;

// --- BECE Custodians ---

const STATE_API_URL = `${API_BASE_URL}/states`;

export const getBECECustodiansByState = async (stateName: string): Promise<any[]> => {
    const response = await fetch(`${STATE_API_URL}/${encodeURIComponent(stateName)}/bece-custodians`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch BECE custodians by state');
    }
    return response.json();
};

export const getSSCECustodiansByState = async (stateName: string): Promise<any[]> => {
    const response = await fetch(`${STATE_API_URL}/${encodeURIComponent(stateName)}/ssce-custodians`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch SSCE custodians by state');
    }
    return response.json();
};

export const getAllBECECustodians = async (onlyActive: boolean = false): Promise<any[]> => {
    const response = await fetch(`${BECE_API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all BECE Custodians');
    }
    const data = await response.json();
    const items = data.items || [];
    return onlyActive ? items.filter((i: any) => i.active) : items;
};

export const createBECECustodian = async (data: any): Promise<any> => {
    const response = await fetch(BECE_API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create BECE Custodian');
    }
    return response.json();
};

export const updateBECECustodian = async (id: string, data: any): Promise<any> => {
    const response = await fetch(`${BECE_API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update BECE Custodian');
    }
    return response.json();
};

export const deleteBECECustodian = async (id: string): Promise<void> => {
    const response = await fetch(`${BECE_API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete BECE Custodian');
    }
};

export const bulkDeleteBECECustodians = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${BECE_API_URL}/all`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
        throw new Error('Failed to bulk delete BECE Custodians');
    }
};

export const uploadBECECustodianCsv = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${BECE_API_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });
    if (!response.ok) {
        throw new Error('Failed to upload BECE Custodian CSV');
    }
    return response.json();
};

// --- SSCE Custodians ---

export const getAllSSCECustodians = async (onlyActive: boolean = false): Promise<any[]> => {
    const response = await fetch(`${SSCE_API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all SSCE Custodians');
    }
    const data = await response.json();
    const items = data.items || [];
    return onlyActive ? items.filter((i: any) => i.active) : items;
};

export const createSSCECustodian = async (data: any): Promise<any> => {
    const response = await fetch(SSCE_API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create SSCE Custodian');
    }
    return response.json();
};

export const updateSSCECustodian = async (id: string, data: any): Promise<any> => {
    const response = await fetch(`${SSCE_API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update SSCE Custodian');
    }
    return response.json();
};

export const deleteSSCECustodian = async (id: string): Promise<void> => {
    const response = await fetch(`${SSCE_API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete SSCE Custodian');
    }
};

export const bulkDeleteSSCECustodians = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${SSCE_API_URL}/all`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
        throw new Error('Failed to bulk delete SSCE Custodians');
    }
};

export const uploadSSCECustodianCsv = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${SSCE_API_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });
    if (!response.ok) {
        throw new Error('Failed to upload SSCE Custodian CSV');
    }
    return response.json();
};

// --- SSCE External Custodians ---

export const getAllSSCEExtCustodians = async (onlyActive: boolean = false): Promise<any[]> => {
    const response = await fetch(`${SSCE_EXT_API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all SSCE External Custodians');
    }
    const data = await response.json();
    const items = data.items || [];
    return onlyActive ? items.filter((i: any) => i.active) : items;
};

export const getSSCEExtCustodiansByState = async (state: string): Promise<any[]> => {
    const response = await fetch(`${SSCE_EXT_API_URL}/state/${state}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch SSCE External custodians by state');
    }
    return response.json();
};

export const createSSCEExtCustodian = async (data: any): Promise<any> => {
    const response = await fetch(SSCE_EXT_API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to create SSCE External Custodian');
    }
    return response.json();
};

export const updateSSCEExtCustodian = async (id: string, data: any): Promise<any> => {
    const response = await fetch(`${SSCE_EXT_API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error('Failed to update SSCE External Custodian');
    }
    return response.json();
};

export const deleteSSCEExtCustodian = async (id: string): Promise<void> => {
    const response = await fetch(`${SSCE_EXT_API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete SSCE External Custodian');
    }
};

export const bulkDeleteSSCEExtCustodians = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${SSCE_EXT_API_URL}/all`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
        throw new Error('Failed to bulk delete SSCE External Custodians');
    }
};

export const uploadSSCEExtCustodianCsv = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${SSCE_EXT_API_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });
    if (!response.ok) {
        throw new Error('Failed to upload SSCE External Custodian CSV');
    }
    return response.json();
};
