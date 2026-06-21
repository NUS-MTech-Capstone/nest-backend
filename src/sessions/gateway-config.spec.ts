import {
  resolveGatewayCognitoClientId,
  resolveGatewayUrl,
} from './gateway-config';

describe('gateway-config', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.SSH_GATEWAY_URL;
    delete process.env.SSH_GATEWAY_SERVICE_HOST;
    delete process.env.SSH_GATEWAY_SERVICE_PORT;
    delete process.env.SSH_GATEWAY_COGNITO_CLIENT_ID;
    delete process.env.COGNITO_CLIENT_ID;
  });

  afterEach(() => {
    process.env = env;
  });

  describe('resolveGatewayUrl', () => {
    it('prefers SSH_GATEWAY_URL and strips a trailing slash', () => {
      process.env.SSH_GATEWAY_URL = 'http://ssh-gateway:8080/';
      expect(resolveGatewayUrl()).toBe('http://ssh-gateway:8080');
    });

    it('builds a URL from Kubernetes service env vars', () => {
      process.env.SSH_GATEWAY_SERVICE_HOST = 'ssh-gateway';
      process.env.SSH_GATEWAY_SERVICE_PORT = '9090';
      expect(resolveGatewayUrl()).toBe('http://ssh-gateway:9090');
    });

    it('returns empty string when nothing is configured', () => {
      expect(resolveGatewayUrl()).toBe('');
    });
  });

  describe('resolveGatewayCognitoClientId', () => {
    it('prefers SSH_GATEWAY_COGNITO_CLIENT_ID', () => {
      process.env.SSH_GATEWAY_COGNITO_CLIENT_ID = 'gateway-client';
      process.env.COGNITO_CLIENT_ID = 'app-client';
      expect(resolveGatewayCognitoClientId()).toBe('gateway-client');
    });

    it('falls back to COGNITO_CLIENT_ID', () => {
      process.env.COGNITO_CLIENT_ID = 'app-client';
      expect(resolveGatewayCognitoClientId()).toBe('app-client');
    });
  });
});
