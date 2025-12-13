export interface Assignment {
    id: string;
    code: string;
    name: string;
    mandates: string[];
    active: boolean;
    created_at?: string;
    updated_at?: string;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface AssignmentCreate {
    code: string;
    name: string;
    mandates?: string[];
    active?: boolean;
}

export interface AssignmentUpdate {
    code: string;
    name: string;
    mandates?: string[];
    active?: boolean;
}

export interface AssignmentListResponse {
    items: Assignment[];
    total: number;
    skip: number;
    limit: number;
}

export interface AssignmentBulkUploadResponse {
    created_count: number;
    skipped_count: number;
    error_count: number;
    skipped: any[];
    errors: any[];
}
