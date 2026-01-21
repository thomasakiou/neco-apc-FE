export interface HODPostingResponse {
    id: string;
    file_no: string;
    name: string;
    state?: string | null;
    station?: string | null;
    conraiss?: string | null;
    year?: string | null;
    assignment_venue?: any[] | null;
    assignments?: any[] | null;
    mandates?: any[] | null;
    count?: number | null;
    posted_for?: number | null;
    to_be_posted?: number | null;
    numb_of__nites?: number | null;
    description?: string | null;
    created_at?: string;
    updated_at?: string;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface HODPostingCreate {
    file_no: string;
    name: string;
    state?: string | null;
    station?: string | null;
    conraiss?: string | null;
    year?: string | null;
    assignment_venue?: any[] | null;
    assignments?: any[] | null;
    mandates?: any[] | null;
    count?: number | null;
    posted_for?: number | null;
    to_be_posted?: number | null;
    numb_of__nites?: number | null;
    description?: string | null;
}

export interface HODPostingListResponse {
    items: HODPostingResponse[];
    total: number;
    skip: number;
    limit: number;
}

export interface BulkHODPostingCreateRequest {
    items: HODPostingCreate[];
}

export interface HODPostingBulkUploadResponse {
    created_count: number;
    skipped_count: number;
    error_count: number;
    skipped: any[];
    errors: any[];
}
