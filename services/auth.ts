import { Token, UserResponse } from '../types/auth';
import { API_BASE_URL } from '../src/config';
import { getAuthHeaders } from './apiUtils';

const AUTH_URL = `${API_BASE_URL}/auth`;

export const login = async (username: string, password: string): Promise<Token> => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${AUTH_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Login failed' }));
        throw new Error(errorData.detail || 'Login failed');
    }

    const token: Token = await response.json();
    localStorage.setItem('token', token.access_token);
    return token;
};

export const getMe = async (): Promise<UserResponse> => {
    const response = await fetch(`${AUTH_URL}/me`, {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        localStorage.removeItem('token');
        throw new Error('Failed to fetch user info');
    }

    return response.json();
};

export const changePassword = async (old_password: string, new_password: string): Promise<void> => {
    const response = await fetch(`${AUTH_URL}/change-password`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ old_password, new_password }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to change password' }));
        throw new Error(errorData.detail || 'Failed to change password');
    }
};

export const logout = () => {
    localStorage.removeItem('token');
};

export const getStoredToken = () => {
    return localStorage.getItem('token');
};
