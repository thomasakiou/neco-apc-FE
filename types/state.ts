export interface State {
    id: string;
    state_code: string;
    name: string;
    capital: string;
    zone?: string | null;
    mkv_count: number;
    schools_count: number;
    custodians_count: number;
    created_at?: string;
    updated_at?: string;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface StateListResponse {
    items: State[];
    total: number;
    skip: number;
    limit: number;
}

export interface StateCreate {
    state_code: string;
    name: string;
    capital: string;
    zone?: string | null;
    mkv_count?: number;
    schools_count?: number;
    custodians_count?: number;
}

export interface StateUpdate extends Partial<StateCreate> { }

export interface BulkUploadResponse {
    created_count: number;
    skipped_count: number;
    error_count: number;
    skipped: any[];
    errors: any[];
}

// Related entities
export interface MarkingVenue {
    id: string;
    state_id: string;
    name: string;
    code?: string | null;
    address?: string | null;
    parcels: number;
    active: boolean;
    created_at?: string;
    updated_at?: string;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface Custodian {
    id: string;
    state_id: string;
    name: string;
    code?: string | null;
    address?: string | null;
    schools: number;
    active: boolean;
    created_at?: string;
    updated_at?: string;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface School {
    id: string;
    state_id: string;
    name: string;
    code?: string | null;
    address?: string | null;
    candidates: number;
    active: boolean;
    created_at?: string;
    updated_at?: string;
    created_by?: string | null;
    updated_by?: string | null;
}
