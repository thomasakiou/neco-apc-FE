export interface DriverFinalPostingResponse {
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
    state?: string | null;
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

export interface DriverFinalPostingListResponse {
    items: DriverFinalPostingResponse[];
    total: number;
    skip: number;
    limit: number;
}

export interface DriverFinalPostingCreate {
    file_no: string;
    name: string;
    station?: string | null;
    conraiss?: string | null;
    sex?: string | null;
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
