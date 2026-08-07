import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_ROOT = path.join(ROOT, 'tests');

async function discoverTests(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await discoverTests(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.test.mjs')) {
      files.push(fullPath);
    }
  }

  return files;
}

const coverage = process.argv.includes('--coverage');
const tests = (await discoverTests(TEST_ROOT)).sort();

if (tests.length === 0) {
  console.error('No test files discovered under tests/**/*.test.mjs');
  process.exit(1);
}

console.log(`Discovered ${tests.length} test files recursively.`);

const args = [];
if (coverage) {
  args.push(
    '--experimental-test-coverage',
    '--test-coverage-lines=90',
    '--test-coverage-branches=74',
    '--test-coverage-functions=88',
    "--test-coverage-include=src/**/*.js",
    "--test-coverage-include=src/**/*.jsx",
    "--test-coverage-include=scripts/**/*.mjs",
    '--test-coverage-exclude=scripts/run-tests.mjs',
  );
}
args.push('--test', ...tests);

const child = spawn(process.execPath, args, {
  cwd: ROOT,
  stdio: 'inherit',
  shell: false,
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Test runner terminated by signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
