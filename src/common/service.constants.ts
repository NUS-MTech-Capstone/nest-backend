/** Platform-wide service identifier for DenDenMushi backend. */
export const SERVICE_NAME = 'ddm';

/** Header used for API version negotiation (header versioning only). */
export const API_VERSION_HEADER = 'x-api-version';

export const SUPPORTED_API_VERSION = '1';

export const servicePath = (segment: string): string =>
  `${SERVICE_NAME}/${segment}`;
