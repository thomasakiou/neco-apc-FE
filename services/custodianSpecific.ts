import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const BECE_API_URL = `${API_BASE_URL}/bece-custodians`;
const SSCE_API_URL = `${API_BASE_URL}/ssce-custodians`;
const SSCE_EXT_API_URL = `${API_BASE_URL}/ssce-ext-custodians`;

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

let beceCache: { data: any[], timestamp: number } | null = null;
let ssceCache: { data: any[], timestamp: number } | null = null;
let ssceExtCache: { data: any[], timestamp: number } | null = null;

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

export const getAllBECECustodians = async (onlyActive: boolean = false, force: boolean = false): Promise<any[]> => {
    if (!force && beceCache && (Date.now() - beceCache.timestamp < CACHE_TTL)) {
        return onlyActive ? beceCache.data.filter((i: any) => i.active) : beceCache.data;
    }

    const response = await fetch(`${BECE_API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all BECE Custodians');
    }
    const data = await response.json();
    const items = data.items || [];

    beceCache = { data: items, timestamp: Date.now() };
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
    beceCache = null; // Invalidate cache
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
    beceCache = null; // Invalidate cache
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
    beceCache = null; // Invalidate cache
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
    beceCache = null; // Invalidate cache
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
    beceCache = null; // Invalidate cache
    return response.json();
};

// --- SSCE Custodians ---

export const getAllSSCECustodians = async (onlyActive: boolean = false, force: boolean = false): Promise<any[]> => {
    if (!force && ssceCache && (Date.now() - ssceCache.timestamp < CACHE_TTL)) {
        return onlyActive ? ssceCache.data.filter((i: any) => i.active) : ssceCache.data;
    }

    const response = await fetch(`${SSCE_API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all SSCE Custodians');
    }
    const data = await response.json();
    const items = data.items || [];

    ssceCache = { data: items, timestamp: Date.now() };
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
    ssceCache = null; // Invalidate
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
    ssceCache = null; // Invalidate
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
    ssceCache = null; // Invalidate
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
    ssceCache = null; // Invalidate
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
    ssceCache = null; // Invalidate
    return response.json();
};

// --- SSCE External Custodians ---

export const getAllSSCEExtCustodians = async (onlyActive: boolean = false, force: boolean = false): Promise<any[]> => {
    if (!force && ssceExtCache && (Date.now() - ssceExtCache.timestamp < CACHE_TTL)) {
        return onlyActive ? ssceExtCache.data.filter((i: any) => i.active) : ssceExtCache.data;
    }

    const response = await fetch(`${SSCE_EXT_API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all SSCE External Custodians');
    }
    const data = await response.json();
    const items = data.items || [];

    ssceExtCache = { data: items, timestamp: Date.now() };
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
    ssceExtCache = null; // Invalidate
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
    ssceExtCache = null; // Invalidate
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
    ssceExtCache = null; // Invalidate
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
    ssceExtCache = null; // Invalidate
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
    ssceExtCache = null; // Invalidate
    return response.json();
};
