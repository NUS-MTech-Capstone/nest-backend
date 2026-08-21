import type { NextFunction, Request, Response } from 'express';
import {
  REQUEST_ID_HEADER,
  RequestIdMiddleware,
  requestIdFrom,
  shouldSkipRequestLog,
} from './observability';

function requestWithHeaders(headers: Record<string, string> = {}): Request {
  const request = {
    headers,
    method: 'GET',
    path: '/ddm/auth/config',
    get(name: string): string | undefined {
      return request.headers[name.toLowerCase()];
    },
  };
  return request as unknown as Request;
}

function responseMock(): {
  response: Response;
  setHeader: jest.Mock;
  on: jest.Mock;
} {
  const setHeader = jest.fn();
  const on = jest.fn();
  return {
    response: { setHeader, on, statusCode: 200 } as unknown as Response,
    setHeader,
    on,
  };
}

describe('shouldSkipRequestLog', () => {
  it('suppresses successful health probe request logs only', () => {
    expect(shouldSkipRequestLog('GET', '/healthz', 200)).toBe(true);
    expect(shouldSkipRequestLog('GET', '/readyz', 204)).toBe(true);
    expect(shouldSkipRequestLog('GET', '/healthz', 503)).toBe(false);
    expect(shouldSkipRequestLog('POST', '/healthz', 200)).toBe(false);
    expect(shouldSkipRequestLog('GET', '/ddm/auth/config', 200)).toBe(false);
  });
});

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  it('trims and propagates an incoming request ID', () => {
    const request = requestWithHeaders({ 'x-request-id': '  request-123  ' });
    const { response, setHeader, on } = responseMock();
    const next = jest.fn() as NextFunction;

    middleware.use(request, response, next);

    expect(request.headers['x-request-id']).toBe('request-123');
    expect(requestIdFrom(request)).toBe('request-123');
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'request-123');
    expect(on).toHaveBeenCalledWith('finish', expect.any(Function));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates and propagates a request ID when the header is absent', () => {
    const request = requestWithHeaders();
    const { response, setHeader } = responseMock();
    const next = jest.fn() as NextFunction;

    middleware.use(request, response, next);

    const requestId = requestIdFrom(request);
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(request.headers['x-request-id']).toBe(requestId);
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
