import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

type PlainObject = Record<string, unknown>;

function loadYaml(filePath: string): PlainObject {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return (yaml.load(raw) as PlainObject) ?? {};
}

function mergeYamlDir(dirPath: string): PlainObject {
  if (!fs.existsSync(dirPath)) return {};

  return fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .reduce<PlainObject>((acc, file) => {
      const parsed = loadYaml(path.join(dirPath, file));
      return { ...acc, ...parsed };
    }, {});
}

/**
 * Builds the complete OpenAPI spec by merging YAML files from docs/ at the
 * project root. Uses process.cwd() so the path is correct both in development
 * (tsx) and in production (compiled dist/).
 *
 * docs/
 * ├── openapi.yaml          root spec (info, tags)
 * ├── paths/*.yaml          one file per domain (auth, users, courses, …)
 * └── components/
 *     ├── schemas.yaml
 *     └── security-schemes.yaml
 */
export function loadOpenApiSpec(servers: { url: string; description: string }[]): PlainObject {
  const docsDir = path.join(process.cwd(), 'docs');

  const root = loadYaml(path.join(docsDir, 'openapi.yaml'));
  const paths = mergeYamlDir(path.join(docsDir, 'paths'));
  const schemas = loadYaml(path.join(docsDir, 'components', 'schemas.yaml'));
  const securitySchemes = loadYaml(path.join(docsDir, 'components', 'security-schemes.yaml'));

  return {
    ...root,
    servers,
    paths,
    components: {
      schemas,
      securitySchemes,
    },
  };
}
