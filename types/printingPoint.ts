export interface PrintingPoint {
    id: string;
    name: string;
    state?: string | null;
    status?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface PrintingPointCreate {
    name: string;
    state?: string | null;
    status?: string | null;
}

export interface PrintingPointUpdate {
    name: string;
    state?: string | null;
    status?: string | null;
}

export interface PrintingPointListResponse {
    items: PrintingPoint[];
    total: number;
    skip: number;
    limit: number;
}

export interface PrintingPointBulkUploadResponse {
    created_count: number;
    error_count: number;
    errors: any[];
}
