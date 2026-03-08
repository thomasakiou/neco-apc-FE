export interface ArchiveRecord {
    id: string;
    file_no: string;
    name: string;
    conraiss?: string | null;
    station?: string | null;
    year?: string | null;
    comment?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface ArchiveCreate {
    file_no: string;
    name: string;
    conraiss?: string | null;
    station?: string | null;
    year?: string | null;
    comment?: string | null;
}

export interface ArchiveUpdate {
    file_no?: string | null;
    name?: string | null;
    conraiss?: string | null;
    station?: string | null;
    year?: string | null;
    comment?: string | null;
}

export interface ArchiveListResponse {
    items: ArchiveRecord[];
    total: number;
    skip: number;
    limit: number;
}
