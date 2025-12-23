import { APCRecord } from './apc';

export interface HODApcRecord extends APCRecord { }

export interface HODApcListResponse {
    items: HODApcRecord[];
    total: number;
    skip: number;
    limit: number;
}

export interface HODApcCreate {
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
}

export type HODApcUpdate = Partial<HODApcCreate>;
