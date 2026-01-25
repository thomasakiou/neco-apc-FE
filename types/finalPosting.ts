export interface FinalPostingResponse {
    id: string;
    file_no: string;
    name: string;
    station?: string | null;
    conraiss?: string | null;
    sex?: string | null;
    year?: string | null;
    assignment_venue?: any[] | null;
    assignments?: any[] | null;
    mandates?: any[] | null;
    state?: string[] | null;
    count?: number | null;
    posted_for?: number | null;
    to_be_posted?: number | null;
    description?: string | null;
    venue_code?: string[] | null;
    created_at?: string | null;
    updated_at?: string | null;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface FinalPostingListResponse {
    items: FinalPostingResponse[];
    total: number;
    skip: number;
    limit: number;
}

export interface FinalPostingCreate {
    file_no: string;
    name: string;
    station?: string | null;
    conraiss?: string | null;
    sex?: string | null;
    year?: string | null;
    assignment_venue?: any[] | null;
    assignments?: any[] | null;
    mandates?: any[] | null;
    state?: string[] | null;
    count?: number | null;
    posted_for?: number | null;
    to_be_posted?: number | null;
    description?: string | null;
}

export interface FinalPostingUpdate {
    file_no?: string | null;
    name?: string | null;
    station?: string | null;
    conraiss?: string | null;
    sex?: string | null;
    year?: string | null;
    assignment_venue?: any[] | null;
    assignments?: any[] | null;
    mandates?: any[] | null;
    state?: string[] | null;
    count?: number | null;
    posted_for?: number | null;
    to_be_posted?: number | null;
    description?: string | null;
}

export interface BulkFinalPostingCreateRequest {
    items: FinalPostingCreate[];
}

export interface FinalPostingBulkUploadResponse {
    created_count: number;
    skipped_count: number;
    error_count: number;
    skipped: any[];
    errors: any[];
}
