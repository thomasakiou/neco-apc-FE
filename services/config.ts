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
        throw new Error(`Failed to fetch module locks: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Normalizing different possible backend response formats
    if (Array.isArray(data)) {
        return data.reduce((acc, item) => {
            if (item.module_name) {
                acc[item.module_name] = !!item.is_locked;
            }
            return acc;
        }, {} as ModuleLocksResponse);
    }

    if (data && typeof data === 'object' && 'module_locks' in data) {
        return data.module_locks as ModuleLocksResponse;
    }

    return data as ModuleLocksResponse;
};

export const updateModuleLock = async (data: ModuleLockUpdate): Promise<void> => {
    console.log('[ConfigService] Updating module lock:', data);
    const response = await fetch(`${CONFIG_URL}/module-locks`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to update module lock' }));
        console.error('[ConfigService] Failed to update module lock:', errorData);
        throw new Error(errorData.detail || 'Failed to update module lock');
    }
    console.log('[ConfigService] Module lock update successful');
};
