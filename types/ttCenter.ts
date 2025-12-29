export interface TTCenter {
    id: string;
    sch_name: string;
    sch_no: string | null;
    state: string | null;
    active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface TTCenterCreate {
    sch_name: string;
    sch_no?: string;
    state?: string;
    active?: boolean;
}

export interface TTCenterUpdate {
    sch_name?: string;
    sch_no?: string;
    state?: string;
    active?: boolean;
}

export interface TTCenterListResponse {
    items: TTCenter[];
    total: number;
    skip: number;
    limit: number;
}

export interface TTCenterBulkUploadResponse {
    created_count: number;
    skipped_count: number;
    error_count: number;
    skipped: any[];
    errors: any[];
}
