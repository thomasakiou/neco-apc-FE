import { API_BASE_URL } from '../src/config';
import { getAuthHeaders } from './apiUtils';

const CONFIG_URL = `${API_BASE_URL}/config`;

export interface ModuleLocksResponse {
    [key: string]: boolean;
}

export interface ModuleLockUpdate {
    module_name: string;
    is_locked: boolean;
}

export const getModuleLocks = async (): Promise<ModuleLocksResponse> => {
    const response = await fetch(`${CONFIG_URL}/module-locks`, {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error('Failed to fetch module locks');
    }

    return response.json();
};

export const updateModuleLock = async (data: ModuleLockUpdate): Promise<void> => {
    const response = await fetch(`${CONFIG_URL}/module-locks`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to update module lock' }));
        throw new Error(errorData.detail || 'Failed to update module lock');
    }
};
