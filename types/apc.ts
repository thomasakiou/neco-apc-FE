export interface APCRecord {
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
    created_at?: string | null;
    updated_at?: string | null;
    created_by?: string | null;
    updated_by?: string | null;
}

export interface APCListResponse {
    items: APCRecord[];
    total: number;
    skip: number;
    limit: number;
}

export interface APCCreate {
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

export type APCUpdate = Partial<APCCreate>;

// Types for Mandate Staff Assignment UI
export interface StaffMandateAssignment {
    id: string; // Staff ID
    staff_no: string;
    staff_name: string;
    rank: string;
    current_station: string;
    conr?: string;
    apc_id?: string; // ID of the APC record if assigned
    mandate_id?: string | null; // ID of the mandate if assigned

    // Draft State
    pendingAction?: 'add' | 'remove' | 'move';
    originalMandateId?: string | null; // To track changes
}

export interface MandateColumn {
    id: string; // Mandate ID
    title: string;
    code: string;
    station?: string;
    active: boolean;
    staff: StaffMandateAssignment[];
}

export interface AssignmentBoardData {
    assignmentId: string;
    unassignedStaff: StaffMandateAssignment[];
    mandateColumns: MandateColumn[];
}

export interface BoardChange {
    staffId: string;
    action: 'add' | 'remove' | 'move';
    mandateId: string | null;
    previousMandateId?: string | null;
}
