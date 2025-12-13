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

export interface SchoolListResponse {
    items: School[];
    total: number;
    skip: number;
    limit: number;
}

export interface SchoolCreate {
    state_id: string;
    name: string;
    code?: string | null;
    address?: string | null;
    candidates?: number;
    active?: boolean;
}

export interface SchoolUpdate extends Partial<SchoolCreate> { }

export interface BulkUploadResponse {
    created_count: number;
    skipped_count: number;
    error_count: number;
    skipped: any[];
    errors: any[];
}
