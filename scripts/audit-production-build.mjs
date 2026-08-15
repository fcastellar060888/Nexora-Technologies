import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const forbiddenBasenames = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
]);

const forbiddenExtensions = new Set([
  '.map',
  '.jsx',
  '.tsx',
  '.ts',
  '.mjs',
  '.cjs',
]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

try {
  const distStat = await stat(DIST);
  if (!distStat.isDirectory()) throw new Error('dist/ is not a directory');
} catch {
  console.error('Production build audit requires an existing dist/ directory. Run npm run build first.');
  process.exit(1);
}

const files = (await walk(DIST)).sort();
if (files.length === 0) {
  console.error('Production build audit failed: dist/ is empty.');
  process.exit(1);
}

const violations = [];
for (const file of files) {
  const relative = path.relative(DIST, file).split(path.sep).join('/');
  const basename = path.basename(file);
  const extension = path.extname(file).toLowerCase();

  if (forbiddenBasenames.has(basename)) {
    violations.push(`${relative}: forbidden internal/configuration file`);
  }
  if (forbiddenExtensions.has(extension)) {
    violations.push(`${relative}: forbidden source/debug extension ${extension}`);
  }

  if (extension === '.js' || extension === '.css' || extension === '.html') {
    const content = await readFile(file, 'utf8');
    if (/sourceMappingURL\s*=/.test(content)) {
      violations.push(`${relative}: contains sourceMappingURL reference`);
    }
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) {
      violations.push(`${relative}: contains private-key material`);
    }
  }
}

if (violations.length > 0) {
  console.error('Production build audit failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Production build audit: OK (${files.length} files checked; no source maps or forbidden artifacts).`);
