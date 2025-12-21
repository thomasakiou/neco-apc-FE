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

    // Check content type
    const contentType = response.headers.get('content-type') || '';
    let sqlText: string;

    if (contentType.includes('application/json')) {
        const jsonResponse = await response.json();
        sqlText = jsonResponse.sql || jsonResponse.data || JSON.stringify(jsonResponse, null, 2);
    } else {
        sqlText = await response.text();
    }

    // Clean up meta-commands that might break standard pgAdmin restoration/execution
    // (Common in DigitalOcean or cloud managed DB exports)
    const cleanedSql = sqlText
        .replace(/^\\restrict\s+.+$/gm, '-- Removed restrict meta-command')
        .replace(/^\\unrestrict\s+.+$/gm, '-- Removed unrestrict meta-command');

    const blob = new Blob([cleanedSql], { type: 'application/sql' });

    // Handle file download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Try to get filename from content-disposition
    const contentDisposition = response.headers.get('content-disposition');
    let fileName = `apcic_backup_${new Date().toISOString().split('T')[0]}.sql`;

    if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (fileNameMatch && fileNameMatch.length > 1) {
            fileName = fileNameMatch[1].replace(/"/g, ''); // Clean quotes
        }
    }

    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};
