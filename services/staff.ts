import { StaffListResponse, StaffCreate, StaffUpdate, Staff } from '../types/staff';

import { API_BASE_URL } from '../src/config';
import { getAuthHeaders, getAuthHeadersFormData } from './apiUtils';

const API_URL = `${API_BASE_URL}/staff`;

/**
 * Maps backend staff object to frontend Staff object.
 */
const isRetiring = (staff: any): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let isAgeRetiring = false;
    if (staff.dob) {
        const dobDate = new Date(staff.dob);
        if (!isNaN(dobDate.getTime())) {
            const retirementDate = new Date(dobDate);
            retirementDate.setFullYear(retirementDate.getFullYear() + 59);
            retirementDate.setHours(0, 0, 0, 0);
            if (today >= retirementDate) {
                isAgeRetiring = true;
            }
        }
    }

    let isServiceRetiring = false;
    if (staff.dofa) {
        const dofaDate = new Date(staff.dofa);
        if (!isNaN(dofaDate.getTime())) {
            const retirementDate = new Date(dofaDate);
            retirementDate.setFullYear(retirementDate.getFullYear() + 34);
            retirementDate.setHours(0, 0, 0, 0);
            if (today >= retirementDate) {
                isServiceRetiring = true;
            }
        }
    }

    return isAgeRetiring || isServiceRetiring;
};

// Exporting simply for reuse in filters if needed, though the name is mutated now.
export { isRetiring };

/**
 * Maps backend staff object to frontend Staff object.
 */
const mapApiStaffToStaff = (apiStaff: any): Staff => {
    if (!apiStaff) return apiStaff;

    // Robust boolean parsing - handles true, 1, '1', 'true', 'True', 'TRUE', etc.
    const toBool = (val: any): boolean => {
        if (val === undefined || val === null) return false;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val === 1;
        if (typeof val === 'string') {
            const lower = val.toLowerCase().trim();
            return lower === 'true' || lower === '1' || lower === 'yes';
        }
        return Boolean(val);
    };

    const retiring = isRetiring(apiStaff);
    let fullName = apiStaff.full_name;
    if (retiring && fullName && !fullName.includes('(Retiring)')) {
        fullName = `${fullName} (Retiring)`;
    }

    return {
        ...apiStaff,
        full_name: fullName,
        is_hod: toBool(apiStaff.is_hod),
        is_director: toBool(apiStaff.is_director),
        is_education: toBool(apiStaff.is_education),
        is_secretary: toBool(apiStaff.is_secretary),
        others: toBool(apiStaff.others),
        // Backend uses 'is_state_cordinator' (with typo)
        is_state_coordinator: toBool(apiStaff.is_state_cordinator ?? apiStaff.is_state_coordinator),
        is_driver: toBool(apiStaff.is_driver),
        is_typesetting: toBool(apiStaff.is_typesetting),
    } as Staff;
};

/**
 * Cleans the payload to match the backend expectations.
 * Backend schema specifies these as boolean types so we send true/false.
 */
const cleanPayload = (data: any, id?: string) => {
    const schemaFields = [
        'fileno', 'full_name', 'station', 'qualification', 'sex',
        'dob', 'dofa', 'doan', 'dopa', 'rank', 'conr',
        'state', 'lga', 'email', 'phone', 'remark'
    ];

    const cleaned: any = {};

    // Include ID if provided (some backends require it in body for PUT)
    if (id) {
        cleaned.id = id;
    }

    // Copy base fields
    schemaFields.forEach(field => {
        // Send values if they exist, but omit nulls to be safe
        if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
            cleaned[field] = data[field];
        } else if (data[field] === null || data[field] === '') {
            cleaned[field] = null; // Explicit null if they want to clear it
        }
    });

    // Handle Booleans as proper booleans (schema specifies boolean type)
    const toBool = (val: any): boolean => {
        if (val === undefined || val === null) return false;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val === 1;
        if (typeof val === 'string') {
            const lower = val.toLowerCase().trim();
            return lower === 'true' || lower === '1' || lower === 'yes';
        }
        return Boolean(val);
    };

    if (data.active !== undefined) cleaned.active = toBool(data.active);
    if (data.is_hod !== undefined) cleaned.is_hod = toBool(data.is_hod);
    if (data.is_education !== undefined) cleaned.is_education = toBool(data.is_education);
    if (data.is_director !== undefined) cleaned.is_director = toBool(data.is_director);
    if (data.is_secretary !== undefined) cleaned.is_secretary = toBool(data.is_secretary);
    if (data.others !== undefined) cleaned.others = toBool(data.others);
    if (data.is_driver !== undefined) cleaned.is_driver = toBool(data.is_driver);
    if (data.is_typesetting !== undefined) cleaned.is_typesetting = toBool(data.is_typesetting);

    // Send ONLY the correct field name used by backend (is_state_cordinator)
    const stateCoordVal = data.is_state_coordinator ?? data.is_state_cordinator;
    if (stateCoordVal !== undefined) {
        const val = toBool(stateCoordVal);
        // Backend uses 'is_state_cordinator' (with typo)
        cleaned.is_state_cordinator = val;
    }

    console.log('[Staff Service] Final Payload:', JSON.stringify(cleaned, null, 2));
    return cleaned;
};

export const getStaffList = async (page: number = 1, limit: number = 10, search: string = ''): Promise<StaffListResponse> => {
    const skip = (page - 1) * limit;
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
    });
    if (search) {
        params.append('search', search);
    }

    const response = await fetch(`${API_URL}?${params.toString()}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch staff list');
    }
    const data = await response.json();
    if (data.items) {
        data.items = data.items.map(mapApiStaffToStaff);
    }
    return data;
};

export const createStaff = async (data: StaffCreate): Promise<Staff> => {
    const payload = cleanPayload(data);

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Create Staff Error:', response.status, errorData);
        throw new Error(errorData.detail ? (typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail)) : 'Failed to create staff');
    }
    const result = await response.json();
    return mapApiStaffToStaff(result);
};

export const updateStaff = async (id: string, data: StaffUpdate): Promise<Staff> => {
    const payload = cleanPayload(data, id);

    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Update Staff Error:', response.status, errorData);
        throw new Error(errorData.detail ? (typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail)) : 'Failed to update staff');
    }
    const result = await response.json();
    return mapApiStaffToStaff(result);
};

export const deleteStaff = async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to delete staff');
    }
};

export const uploadStaffCsv = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Upload Error Details:', errorData);
        throw new Error(errorData.detail || 'Failed to upload staff CSV');
    }
    return response.json();
}

export const appendStaffCsv = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/append`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Append Error Details:', errorData);
        throw new Error(errorData.detail || 'Failed to append staff CSV');
    }
    return response.json();
}

export const promoteStaff = async (file: File, confirm: boolean = false, promotionDate?: string): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams({
        confirm: confirm.toString(),
    });

    if (promotionDate) {
        params.append('promotion_date', promotionDate);
    }

    const response = await fetch(`${API_URL}/promote?${params.toString()}`, {
        method: 'POST',
        headers: getAuthHeadersFormData(),
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Promote Error Details:', errorData);
        throw new Error(errorData.detail || 'Failed to promote staff');
    }
    return response.json();
}

// Global cache for all staff
let allStaffCache: { data: Staff[], timestamp: number } | null = null;
const ALL_STAFF_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export const getAllStaff = async (onlyActive: boolean = false, forceRefresh: boolean = false): Promise<Staff[]> => {
    // Return from cache if available and not expired
    if (!forceRefresh && allStaffCache && (Date.now() - allStaffCache.timestamp < ALL_STAFF_CACHE_TTL)) {
        console.log('[Staff Service] Returning all staff from cache');
        let items = allStaffCache.data;
        if (onlyActive) {
            items = items.filter(item => item.active);
        }
        return items;
    }

    console.log('[Staff Service] Fetching all staff from server');
    const response = await fetch(`${API_URL}?limit=10000`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch all staff');
    }
    const data: StaffListResponse = await response.json();
    const items = (data.items || []).map(mapApiStaffToStaff);

    // Update global cache
    allStaffCache = {
        data: items,
        timestamp: Date.now()
    };

    let result = items;
    if (onlyActive) {
        result = result.filter(item => item.active);
    }
    return result;
};

export const clearAllStaffCache = () => {
    allStaffCache = null;
};

export const bulkDeleteStaff = async (ids: string[]): Promise<void> => {
    const response = await fetch(`${API_URL}/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
        throw new Error('Failed to bulk delete staff records');
    }
};
