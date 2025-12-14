export interface MarkingVenue {
    id: string;
    state: string;
    name: string;
    code?: string | null;
    address?: string | null;
    parcels: number;
    active: boolean;
    created_at?: string;
    updated_at?: string;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface MarkingVenueListResponse {
    items: MarkingVenue[];
    total: number;
    skip: number;
    limit: number;
}

export interface MarkingVenueCreate {
    state: string;
    name: string;
    code?: string | null;
    address?: string | null;
    parcels?: number;
    active?: boolean;
}

export interface MarkingVenueUpdate extends Partial<MarkingVenueCreate> { }

export interface BulkUploadResponse {
    created_count: number;
    skipped_count: number;
    error_count: number;
    skipped: any[];
    errors: any[];
}
