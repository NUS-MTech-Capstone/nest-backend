import type { Request } from 'express';
import {
  buildGatewayAuthHeaders,
  extractGatewayUserAuth,
  sanitizeAlbHeader,
} from './gateway-auth';

describe('gateway-auth', () => {
  describe('sanitizeAlbHeader', () => {
    it('removes internal whitespace from JWT header values', () => {
      expect(sanitizeAlbHeader('eyJhbG. eyJzdWI. sig')).toBe('eyJhbG.eyJzdWI.sig');
    });

    it('returns undefined for empty values', () => {
      expect(sanitizeAlbHeader('   ')).toBeUndefined();
      expect(sanitizeAlbHeader(undefined)).toBeUndefined();
    });
  });

  describe('extractGatewayUserAuth', () => {
    it('collects all ALB OIDC headers', () => {
      const req = {
        headers: {
          'x-amzn-oidc-accesstoken': 'access-token',
          'x-amzn-oidc-data': 'claims-token',
          'x-amzn-oidc-identity': 'user-sub',
        },
      } as unknown as Request;

      expect(extractGatewayUserAuth(req)).toEqual({
        accessToken: 'access-token',
        oidcData: 'claims-token',
        oidcIdentity: 'user-sub',
      });
    });

    it('returns undefined when the access token header is missing', () => {
      const req = { headers: { 'x-amzn-oidc-data': 'claims-token' } } as unknown as Request;
      expect(extractGatewayUserAuth(req)).toBeUndefined();
    });
  });

  describe('buildGatewayAuthHeaders', () => {
    it('forwards Bearer and ALB OIDC headers together', () => {
      expect(
        buildGatewayAuthHeaders('bearer-token', {
          accessToken: 'access-token',
          oidcData: 'claims-token',
          oidcIdentity: 'user-sub',
        }),
      ).toEqual({
        Authorization: 'Bearer bearer-token',
        'x-amzn-oidc-accesstoken': 'access-token',
        'x-amzn-oidc-data': 'claims-token',
        'x-amzn-oidc-identity': 'user-sub',
      });
    });
  });
});
