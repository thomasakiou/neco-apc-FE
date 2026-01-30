export interface DriverAPCRecord {
    id: string;
    file_no: string;
    name: string;
    conraiss?: string | null;
    station?: string | null;
    qualification?: string | null;
    sex?: string | null;
    tt?: string | null;
    mar_accr?: string | null;
    ncee?: string | null;
    gifted?: string | null;
    becep?: string | null;
    bece_mrkp?: string | null;
    ssce_int?: string | null;
    swapping?: string | null;
    ssce_int_mrk?: string | null;
    oct_accr?: string | null;
    ssce_ext?: string | null;
    ssce_ext_mrk?: string | null;
    pur_samp?: string | null;
    int_audit?: string | null;
    stock_tk?: string | null;
    count?: number | null;
    remark?: string | null;
    year?: string | null;
    active: boolean;
    reactivation_date?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    created_by?: string | null;
    updated_by?: string | null;
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
    tt?: string | null;
    mar_accr?: string | null;
    ncee?: string | null;
    gifted?: string | null;
    becep?: string | null;
    bece_mrkp?: string | null;
    ssce_int?: string | null;
    swapping?: string | null;
    ssce_int_mrk?: string | null;
    oct_accr?: string | null;
    ssce_ext?: string | null;
    ssce_ext_mrk?: string | null;
    pur_samp?: string | null;
    int_audit?: string | null;
    stock_tk?: string | null;
    count?: number | null;
    remark?: string | null;
    year?: string | null;
    active?: boolean;
    reactivation_date?: string | null;
}

export type DriverAPCUpdate = Partial<DriverAPCCreate>;
