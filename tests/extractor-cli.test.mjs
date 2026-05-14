import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = '/Users/ovs/Work/summer-rising';
const cliPath = path.join(repoRoot, 'src', 'cli.ts');
const discoveryFixturePath = path.join(
  repoRoot,
  'artifacts',
  'discovery',
  'public-source-endpoints.json',
);

test('inspect command lists glossary-aligned extractor commands', () => {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', cliPath, 'inspect', '--fixture', discoveryFixturePath],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /inspect/);
  assert.match(result.stdout, /snapshot/);
  assert.match(result.stdout, /extract/);
  assert.match(result.stdout, /validate/);
  assert.match(result.stdout, /Source Snapshot/);
});

test('extract command fails loudly when required program year config is absent', () => {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', cliPath, 'extract', '--fixture', discoveryFixturePath],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        SUMMER_RISING_PROGRAM_YEAR: '',
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SUMMER_RISING_PROGRAM_YEAR/);
  assert.match(result.stderr, /Missing required env var/);
});
