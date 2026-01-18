export interface Custodian {
    id: string;
    state?: string | null;
    code?: string | null;
    name: string;
    numb_of_centers: number;
    mandate?: string | null;
    active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface CustodianCreate {
    state?: string | null;
    code?: string | null;
    name: string;
    numb_of_centers?: number;
    mandate?: string | null;
    active?: boolean;
}

export interface CustodianUpdate extends Partial<CustodianCreate> { }

export interface BECECustodian extends Custodian { }
export interface SSCECustodian extends Custodian { }
export interface SSCEExtCustodian extends Custodian { }
