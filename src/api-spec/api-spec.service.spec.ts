import { ApiSpecService } from './api-spec.service';

describe('ApiSpecService', () => {
  it('reads the checked-in OpenAPI spec', () => {
    const spec = new ApiSpecService().readOpenAPI();

    expect(spec).toContain('openapi: 3.1.0');
    expect(spec).toContain('DenDenMushi Nest Backend API');
  });

  it('returns undefined when no candidate spec path exists', () => {
    const service = new ApiSpecService();
    jest.spyOn(service as any, 'candidatePaths').mockReturnValue(['/missing/openapi.yaml']);

    expect(service.readOpenAPI()).toBeUndefined();
  });
});
