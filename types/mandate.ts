export interface Mandate {
    id: string;
    code: string;
    mandate: string;
    conraiss_range: string[];
    station?: string;
    active: boolean;
    created_at?: string;
    updated_at?: string;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface MandateCreate {
    code: string;
    mandate: string;
    conraiss_range?: string[];
    station?: string;
    active?: boolean;
}

export interface MandateUpdate {
    code: string;
    mandate: string;
    conraiss_range?: string[];
    station?: string;
    active?: boolean;
}

export interface MandateListResponse {
    items: Mandate[];
    total: number;
    skip: number;
    limit: number;
}

export interface BulkUploadResponse {
    created_count: number;
    skipped_count: number;
    error_count: number;
    skipped: any[];
    errors: any[];
}
