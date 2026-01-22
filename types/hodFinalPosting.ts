export interface HODFinalPostingResponse {
    id: string;
    file_no: string;
    name: string;
    station?: string | null;
    conraiss?: string | null;
    state?: string | null;
    year?: string | null;
    assignment_venue?: any[] | null;
    assignments?: any[] | null;
    mandates?: any[] | null;
    count?: number | null;
    posted_for?: number | null;
    to_be_posted?: number | null;
    numb_of__nites?: number | null;
    description?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface HODFinalPostingListResponse {
    items: HODFinalPostingResponse[];
    total: number;
    skip: number;
    limit: number;
}

export interface HODFinalPostingCreate {
    file_no: string;
    name: string;
    station?: string | null;
    conraiss?: string | null;
    state?: string | null;
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

export interface HODFinalPostingUpdate {
    file_no?: string | null;
    name?: string | null;
    station?: string | null;
    conraiss?: string | null;
    state?: string | null;
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

export interface BulkHODFinalPostingCreateRequest {
    items: HODFinalPostingCreate[];
}

export interface HODFinalPostingBulkUploadResponse {
    created_count: number;
    skipped_count: number;
    error_count: number;
    skipped: any[];
    errors: any[];
}
