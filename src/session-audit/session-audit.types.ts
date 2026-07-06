export interface AuditSessionSummary {
  sessionId: string;
  userId: string;
  hostId: string;
  crId: string;
  connectionType: string;
  status: string;
  createdAt: string;
  lastAuditAt: string;
  recordCount: number;
  truncated: boolean;
}

export interface ListAuditSessionsResponse {
  sessions: AuditSessionSummary[];
  nextCursor?: string;
}

export interface SessionAuditRecord {
  sessionId: string;
  userId: string;
  hostId: string;
  crId: string;
  recordType: 'command' | 'output' | 'control' | 'session_event';
  sequence: number;
  commandId?: string;
  commandText?: string;
  outputDataBase64?: string;
  createdAt: string;
  truncated: boolean;
  byteCount: number;
}

export interface ListSessionAuditRecordsResponse {
  records: SessionAuditRecord[];
  nextCursor?: string;
}

export interface ListAuditRecordsQuery {
  sessionId?: string;
  userId?: string;
  hostId?: string;
  crId?: string;
  recordType?: 'command' | 'output' | 'control' | 'session_event';
  from?: string;
  to?: string;
  limit?: string;
  cursor?: string;
}

export interface ListAuditSessionsQuery {
  sessionId?: string;
  userId?: string;
  hostId?: string;
  crId?: string;
  from?: string;
  to?: string;
  limit?: string;
  cursor?: string;
}

export interface ListSessionAuditRecordsQuery {
  limit?: string;
  cursor?: string;
}

export interface MetadataEvent {
  schemaVersion: string;
  eventId: string;
  eventType: string;
  source: string;
  occurredAt: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  hostId?: string;
  crId?: string;
  podId?: string;
  instanceId?: string;
  incidentId?: string;
  runId?: string;
  action?: string;
  mode?: string;
  outcome?: string;
  reasonCode?: string;
  planHash?: string;
}

export interface ListMetadataEventsResponse {
  events: MetadataEvent[];
  nextCursor?: string;
}

export interface ListMetadataEventsQuery {
  eventType?: string;
  source?: string;
  userId?: string;
  sessionId?: string;
  hostId?: string;
  crId?: string;
  incidentId?: string;
  runId?: string;
  from?: string;
  to?: string;
  limit?: string;
  cursor?: string;
}
