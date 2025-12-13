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

export interface CustodianListResponse {
    items: Custodian[];
    total: number;
    skip: number;
    limit: number;
}

export interface CustodianCreate {
    state_id: string;
    name: string;
    code?: string | null;
    address?: string | null;
    schools?: number;
    active?: boolean;
}

export interface CustodianUpdate extends Partial<CustodianCreate> { }

export interface BulkUploadResponse {
    created_count: number;
    skipped_count: number;
    error_count: number;
    skipped: any[];
    errors: any[];
}
