export interface AuditLogResponse {
    id: string;
    user_name: string | null;
    action: string;
    entity_name: string;
    entity_id: string | null;
    details: string | null;
    timestamp: string;
}

export interface AuditLogListResponse {
    items: AuditLogResponse[];
    total: number;
    skip: number;
    limit: number;
}
