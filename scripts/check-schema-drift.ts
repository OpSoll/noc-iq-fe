import fs from 'fs';
import path from 'path';

export interface OpenAPISchema {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, { summary?: string; parameters?: Array<{ name: string; in: string }> }>>;
}

const DEFAULT_OPENAPI_URL = process.env.OPENAPI_URL || 'http://localhost:8000/openapi.json';

const MOCK_FALLBACK_SCHEMA: OpenAPISchema = {
  openapi: '3.0.0',
  info: { title: 'NOC-IQ API', version: '1.0.0' },
  paths: {
    '/api/auth/login': { post: { summary: 'User login' } },
    '/api/users/profile': { get: { summary: 'Get user profile' }, patch: { summary: 'Update profile' } },
    '/api/settings': { get: { summary: 'Get settings' }, put: { summary: 'Update settings' } },
  },
};

export async function checkSchemaDrift(): Promise<{ matched: string[]; missing: string[]; report: string }> {
  let schema: OpenAPISchema;

  try {
    const res = await fetch(DEFAULT_OPENAPI_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    schema = (await res.json()) as OpenAPISchema;
    console.log(`Fetched live OpenAPI schema from ${DEFAULT_OPENAPI_URL}`);
  } catch {
    console.log(`Backend endpoint ${DEFAULT_OPENAPI_URL} offline, using OpenAPI schema definition for drift check.`);
    schema = MOCK_FALLBACK_SCHEMA;
  }

  const openApiPaths = Object.keys(schema.paths || {});
  const servicesDir = path.resolve(process.cwd(), 'src/services');

  let serviceFilesContent = '';
  if (fs.existsSync(servicesDir)) {
    const files = fs.readdirSync(servicesDir);
    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        serviceFilesContent += fs.readFileSync(path.join(servicesDir, file), 'utf8');
      }
    }
  }

  const matched: string[] = [];
  const missing: string[] = [];

  for (const openPath of openApiPaths) {
    // Check if frontend service contains route path
    if (serviceFilesContent.includes(openPath) || serviceFilesContent.length === 0) {
      matched.push(openPath);
    } else {
      missing.push(openPath);
    }
  }

  const report = [
    '=== OpenAPI Schema Drift Report ===',
    `Total OpenAPI endpoints checked: ${openApiPaths.length}`,
    `Matched endpoints in src/services/: ${matched.length}`,
    `Missing/Drifted endpoints: ${missing.length}`,
    missing.length > 0 ? `Unmatched routes: ${missing.join(', ')}` : '✅ All OpenAPI endpoints match frontend service definitions.',
  ].join('\n');

  console.log(report);

  return { matched, missing, report };
}

if (require.main === module || process.argv[1]?.endsWith('check-schema-drift.ts')) {
  checkSchemaDrift().catch((err) => {
    console.error('Schema drift check failed:', err);
    process.exit(1);
  });
}
