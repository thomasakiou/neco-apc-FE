import { UserResponse, UserCreate } from '../types/auth';
import { AuditLogListResponse } from '../types/audit';
import { API_BASE_URL } from '../src/config';

import { getAuthHeaders } from './apiUtils';

const USERS_URL = `${API_BASE_URL}/users`;
const AUDIT_URL = `${API_BASE_URL}/audit-logs`;

export const listUsers = async (): Promise<UserResponse[]> => {
    const response = await fetch(`${USERS_URL}/`, {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error('Failed to fetch users');
    }

    return response.json();
};

export const createUser = async (userData: UserCreate): Promise<UserResponse> => {
    const response = await fetch(`${USERS_URL}/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(userData),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to create user' }));
        throw new Error(errorData.detail || 'Failed to create user');
    }

    return response.json();
};

export const getAuditLogs = async (
    skip: number = 0,
    limit: number = 100,
    entityName?: string,
    userName?: string
): Promise<AuditLogListResponse> => {
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });

    if (entityName) params.append('entity_name', entityName);
    if (userName) params.append('user_name', userName);

    const response = await fetch(`${AUDIT_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
    }

    return response.json();
};
