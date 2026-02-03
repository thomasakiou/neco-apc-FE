import { API_BASE_URL } from '../src/config';
import { getAuthHeaders } from './apiUtils';
import { AuditLogListResponse } from '../types/audit';

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

export const getStaffLoginLogs = async (
    skip: number = 0,
    limit: number = 100,
    userName?: string
): Promise<AuditLogListResponse> => {
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });

    if (userName) params.append('user_name', userName);

    const response = await fetch(`${API_URL}/staff-login?${params.toString()}`, {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error('Failed to fetch staff login logs');
    }

    return response.json();
};

export const clearStaffLoginLogs = async (): Promise<void> => {
    const response = await fetch(`${API_URL}/staff-login/clear`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error('Failed to clear staff login logs');
    }
};
