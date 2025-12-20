import { API_BASE_URL } from '../src/config';
import { getAuthHeaders } from './apiUtils';

const BECE_API_URL = `${API_BASE_URL}/bece-custodians`;
const SSCE_API_URL = `${API_BASE_URL}/ssce-custodians`;

export const getAllBECECustodians = async (): Promise<any[]> => {
    const response = await fetch(`${BECE_API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all BECE Custodians');
    }
    const data = await response.json();
    // Assuming the API returns { items: [...] } like others
    return data.items || [];
};

export const getAllSSCECustodians = async (): Promise<any[]> => {
    const response = await fetch(`${SSCE_API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all SSCE Custodians');
    }
    const data = await response.json();
    return data.items || [];
};
