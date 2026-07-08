import { shouldSkipRequestLog } from './observability';

describe('shouldSkipRequestLog', () => {
  it('suppresses successful health probe request logs only', () => {
    expect(shouldSkipRequestLog('GET', '/healthz', 200)).toBe(true);
    expect(shouldSkipRequestLog('GET', '/readyz', 204)).toBe(true);
    expect(shouldSkipRequestLog('GET', '/healthz', 503)).toBe(false);
    expect(shouldSkipRequestLog('POST', '/healthz', 200)).toBe(false);
    expect(shouldSkipRequestLog('GET', '/ddm/auth/config', 200)).toBe(false);
  });
});
