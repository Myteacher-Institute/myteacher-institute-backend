/**
 * OpenAPI spec loader
 *
 * Reads the root openapi.yaml, then merges in all path and component files
 * from their respective subdirectories. Add a new file to paths/ or
 * components/ and it will be picked up automatically.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlainObject = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Load and parse a single YAML file. */
function loadYaml(filePath: string): PlainObject {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return (yaml.load(raw) as PlainObject) ?? {};
}

/** Merge all *.yaml files in a directory into one object. */
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds the complete OpenAPI spec object by merging:
 *   - src/docs/openapi.yaml          (root: info, tags, servers placeholder)
 *   - src/docs/paths/*.yaml          (all path definitions)
 *   - src/docs/components/schemas.yaml
 *   - src/docs/components/security-schemes.yaml
 *
 * The `servers` array is injected at call-time so it reflects runtime env vars.
 */
export function loadOpenApiSpec(servers: { url: string; description: string }[]): PlainObject {
  const docsDir = path.join(__dirname);

  // 1. Root spec (info, tags, empty placeholders)
  const root = loadYaml(path.join(docsDir, 'openapi.yaml'));

  // 2. Merge all path files
  const paths = mergeYamlDir(path.join(docsDir, 'paths'));

  // 3. Merge component files
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
