export interface DriverAPCRecord {
    id: string;
    file_no: string;
    name: string;
    conraiss?: string | null;
    station?: string | null;
    qualification?: string | null;
    sex?: string | null;
    rank?: string | null;
    type_of_vehicle?: string | null;
    tt?: string | null;
    ncee?: string | null;
    gifted?: string | null;
    becep?: string | null;
    bece_mrkp?: string | null;
    ssce_int?: string | null;
    swapping?: string | null;
    ssce_int_mrk?: string | null;
    ssce_ext?: string | null;
    ssce_ext_mrk?: string | null;
    count?: number | null;
    year?: string | null;
    active: boolean;
    reactivation_date?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface DriverAPCListResponse {
    items: DriverAPCRecord[];
    total: number;
    skip: number;
    limit: number;
}

export interface DriverAPCCreate {
    file_no: string;
    name: string;
    conraiss?: string | null;
    station?: string | null;
    qualification?: string | null;
    sex?: string | null;
    rank?: string | null;
    type_of_vehicle?: string | null;
    tt?: string | null;
    ncee?: string | null;
    gifted?: string | null;
    becep?: string | null;
    bece_mrkp?: string | null;
    ssce_int?: string | null;
    swapping?: string | null;
    ssce_int_mrk?: string | null;
    ssce_ext?: string | null;
    ssce_ext_mrk?: string | null;
    count?: number | null;
    year?: string | null;
    active?: boolean;
    reactivation_date?: string | null;
}

export type DriverAPCUpdate = Partial<DriverAPCCreate>;
