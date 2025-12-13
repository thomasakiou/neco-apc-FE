export interface NCEECenter {
    id: string;
    code?: string | null;
    name: string;
    numb_of_cand: number;
    state?: string | null;
    within_capital?: boolean | null;
    outside_capital?: boolean | null;
    active: boolean;
    created_at?: string | null;
    updated_at?: string | null;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface NCEECenterCreate {
    code?: string | null;
    name: string;
    numb_of_cand?: number;
    state?: string | null;
    within_capital?: boolean | null;
    outside_capital?: boolean | null;
    active?: boolean;
}

export interface NCEECenterUpdate {
    code?: string | null;
    name: string;
    numb_of_cand?: number;
    state?: string | null;
    within_capital?: boolean | null;
    outside_capital?: boolean | null;
    active?: boolean;
}

export interface NCEECenterListResponse {
    items: NCEECenter[];
    total: number;
    skip: number;
    limit: number;
}

export interface NCEECenterBulkUploadResponse {
    created_count: number;
    skipped_count: number;
    error_count: number;
    skipped: any[];
    errors: any[];
}