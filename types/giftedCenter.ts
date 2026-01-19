export interface GiftedCenter {
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

export interface GiftedCenterCreate {
    code?: string | null;
    name: string;
    numb_of_cand?: number;
    state?: string | null;
    within_capital?: boolean | null;
    outside_capital?: boolean | null;
    active?: boolean;
}

export interface GiftedCenterUpdate {
    code?: string | null;
    name: string;
    numb_of_cand?: number;
    state?: string | null;
    within_capital?: boolean | null;
    outside_capital?: boolean | null;
    active?: boolean;
}

export interface GiftedCenterListResponse {
    items: GiftedCenter[];
    total: number;
    skip: number;
    limit: number;
}

export interface GiftedCenterBulkUploadResponse {
    created_count: number;
    skipped_count: number;
    error_count: number;
    skipped: any[];
    errors: any[];
}
