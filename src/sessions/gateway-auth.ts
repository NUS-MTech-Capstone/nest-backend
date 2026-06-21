import type { Request } from 'express';

/** ALB OIDC headers from the logged-in user — forwarded to the SSH gateway. */
export interface GatewayUserAuth {
  accessToken: string;
  oidcData?: string;
  oidcIdentity?: string;
}

/** Strip whitespace that some proxies insert into long ALB header values. */
export function sanitizeAlbHeader(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const sanitized = value.replace(/\s+/g, '');
  return sanitized.length > 0 ? sanitized : undefined;
}

/** Read Cognito / ALB auth material from the incoming API request. */
export function extractGatewayUserAuth(req: Request): GatewayUserAuth | undefined {
  const accessToken = sanitizeAlbHeader(req.headers['x-amzn-oidc-accesstoken']);
  if (!accessToken) return undefined;

  return {
    accessToken,
    oidcData: sanitizeAlbHeader(req.headers['x-amzn-oidc-data']),
    oidcIdentity: sanitizeAlbHeader(req.headers['x-amzn-oidc-identity']),
  };
}

/** Headers for server-to-server gateway calls (mirrors what ALB injects externally). */
export function buildGatewayAuthHeaders(
  bearerToken: string | undefined,
  userAuth?: GatewayUserAuth,
): Record<string, string> {
  // ALB-authenticated gateway traffic carries OIDC headers only — not Authorization.
  if (userAuth) {
    const headers: Record<string, string> = {
      'x-amzn-oidc-accesstoken': userAuth.accessToken,
    };
    if (userAuth.oidcData) {
      headers['x-amzn-oidc-data'] = userAuth.oidcData;
    }
    if (userAuth.oidcIdentity) {
      headers['x-amzn-oidc-identity'] = userAuth.oidcIdentity;
    }
    return headers;
  }

  if (!bearerToken) {
    return {};
  }

  return { Authorization: `Bearer ${bearerToken}` };
}
