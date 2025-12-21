import { API_BASE_URL } from '../src/config';
import { getAuthHeaders } from './apiUtils';

const API_URL = `${API_BASE_URL}/audit-logs`;

export const deleteAuditLog = async (logId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${logId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error('Failed to delete audit log');
    }
};

export const clearAllAuditLogs = async (): Promise<void> => {
    const response = await fetch(`${API_URL}/all/clear`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error('Failed to clear audit logs');
    }
};
