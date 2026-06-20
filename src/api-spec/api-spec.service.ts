import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

@Injectable()
export class ApiSpecService {
  readOpenAPI(): string | undefined {
    for (const path of this.candidatePaths()) {
      if (existsSync(path)) {
        return readFileSync(path, 'utf8');
      }
    }
    return undefined;
  }

  private candidatePaths(): string[] {
    return [
      resolve(process.cwd(), 'api/openapi.yaml'),
      resolve(process.cwd(), 'dist/api/openapi.yaml'),
      resolve(__dirname, '../api/openapi.yaml'),
      resolve(__dirname, '../../api/openapi.yaml'),
    ];
  }
}
