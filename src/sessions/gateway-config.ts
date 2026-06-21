/** Resolve the SSH gateway base URL for server-to-server calls. */
export function resolveGatewayUrl(): string {
  const explicit = process.env.SSH_GATEWAY_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  // Kubernetes can inject these when the gateway Service is linked in the pod spec.
  const host = process.env.SSH_GATEWAY_SERVICE_HOST?.trim();
  if (host) {
    const port = process.env.SSH_GATEWAY_SERVICE_PORT?.trim() || '8080';
    return `http://${host}:${port}`;
  }

  return '';
}

/** Cognito app client used for optional service-account gateway auth (dev/local). */
export function resolveGatewayCognitoClientId(): string {
  return (
    process.env.SSH_GATEWAY_COGNITO_CLIENT_ID?.trim() ||
    process.env.COGNITO_CLIENT_ID?.trim() ||
    ''
  );
}
