import { API_BASE_URL } from '../src/config';
import { getAuthHeaders } from './apiUtils';

const DATABASE_URL = `${API_BASE_URL}/database`;

export const downloadDatabaseBackup = async (): Promise<void> => {
    const response = await fetch(`${DATABASE_URL}/backup`, {
        method: 'GET',
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to generate backup' }));
        throw new Error(errorData.detail || 'Failed to generate backup');
    }

    // Handle file download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Try to get filename from content-disposition
    const contentDisposition = response.headers.get('content-disposition');
    let fileName = `apcic_backup_${new Date().toISOString().split('T')[0]}.sql`;

    if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (fileNameMatch && fileNameMatch.length > 1) {
            fileName = fileNameMatch[1];
        }
    }

    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};
