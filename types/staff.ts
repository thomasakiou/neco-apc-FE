export interface Staff {
    fileno: string;
    full_name: string;
    station?: string | null;
    qualification?: string | null;
    sex?: string | null;
    dob?: string | null;
    dofa?: string | null;
    doan?: string | null; // Date of Appointment to NECO - added from backend
    dopa?: string | null;
    rank?: string | null;
    conr?: string | null;
    state?: string | null;
    lga?: string | null;
    email?: string | null;
    phone?: string | null;
    remark?: string | null;
    is_hod: boolean;
    is_state_coordinator: boolean;
    is_state_cordinator?: boolean; // Backend typo mapping
    is_secretary: boolean;
    others: boolean;
    is_director: boolean;
    is_education: boolean;
    active: boolean;
    id: string;
    created_at?: string | null;
    updated_at?: string | null;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface StaffListResponse {
    items: Staff[];
    total: number;
    skip: number;
    limit: number;
}

export interface StaffCreate {
    fileno: string;
    full_name: string;
    station?: string | null;
    qualification?: string | null;
    sex?: string | null;
    dob?: string | null;
    dofa?: string | null;
    doan?: string | null; // Date of Appointment to NECO - added from backend
    dopa?: string | null;
    rank?: string | null;
    conr?: string | null;
    state?: string | null;
    lga?: string | null;
    email?: string | null;
    phone?: string | null;
    remark?: string | null;
    is_hod?: boolean;
    is_state_coordinator?: boolean;
    is_state_cordinator?: boolean; // Backend typo mapping
    is_secretary?: boolean;
    others?: boolean;
    is_director?: boolean;
    is_education?: boolean;
    active?: boolean;
}

export interface StaffUpdate extends Partial<StaffCreate> { }

export interface BulkUploadResponse {
    created_count: number;
    skipped_count: number;
    error_count: number;
    skipped: any[];
    errors: any[];
}
