import { Controller, Get, Header, NotFoundException } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { ApiSpecService } from './api-spec.service';

@Controller('openapi.yaml')
export class ApiSpecController {
  constructor(private readonly apiSpecService: ApiSpecService) {}

  @Get()
  @Public()
  @Header('Content-Type', 'application/yaml; charset=utf-8')
  getOpenAPI(): string {
    const spec = this.apiSpecService.readOpenAPI();
    if (!spec) {
      throw new NotFoundException('OpenAPI spec not found');
    }
    return spec;
  }
}
