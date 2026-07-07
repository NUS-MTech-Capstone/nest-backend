import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  ListAuditRecordsQuery,
  ListAuditSessionsQuery,
  ListAuditSessionsResponse,
  ListMetadataEventsQuery,
  ListMetadataEventsResponse,
  ListSessionAuditRecordsQuery,
  ListSessionAuditRecordsResponse,
} from './session-audit.types';

@Injectable()
export class SessionAuditService {
  private readonly sessionAuditUrl = (process.env.SESSION_AUDIT_URL ?? '').replace(/\/+$/, '');

  async listSessions(query: ListAuditSessionsQuery): Promise<ListAuditSessionsResponse> {
    return this.get<ListAuditSessionsResponse>('/sessions/audit', query);
  }

  async listRecordsGlobal(query: ListAuditRecordsQuery): Promise<ListSessionAuditRecordsResponse> {
    return this.get<ListSessionAuditRecordsResponse>('/sessions/audit/records', query);
  }

  async listRecords(
    sessionId: string,
    query: ListSessionAuditRecordsQuery,
  ): Promise<ListSessionAuditRecordsResponse> {
    return this.get<ListSessionAuditRecordsResponse>(
      `/sessions/${encodeURIComponent(sessionId)}/audit/records`,
      query,
    );
  }

  async listMetadataEvents(query: ListMetadataEventsQuery): Promise<ListMetadataEventsResponse> {
    return this.get<ListMetadataEventsResponse>('/events', query);
  }

  private async get<T>(path: string, query: object): Promise<T> {
    if (!this.sessionAuditUrl) {
      throw new ServiceUnavailableException('SESSION_AUDIT_URL is not configured');
    }
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    }
    const url = `${this.sessionAuditUrl}${path}${params.size ? `?${params.toString()}` : ''}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { 'x-api-version': '1' },
      });
    } catch {
      throw new BadGatewayException('Audit Service is unavailable');
    }
    if (!response.ok) {
      throw new BadGatewayException(`Audit Service returned ${response.status}`);
    }
    return response.json() as Promise<T>;
  }
}
