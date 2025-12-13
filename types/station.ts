export interface Station {
    id: string;
    station_code: string;
    station: string;
    active: boolean;
    created_at?: string;
    updated_at?: string;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface StationListResponse {
    items: Station[];
    total: number;
    skip: number;
    limit: number;
}

export interface StationCreate {
    station_code: string;
    station: string;
    active?: boolean;
}

export interface StationUpdate extends Partial<StationCreate> { }

export interface BulkUploadResponse {
    created_count: number;
    skipped_count: number;
    error_count: number;
    skipped: any[];
    errors: any[];
}
