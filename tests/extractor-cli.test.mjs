import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';

const repoRoot = '/Users/ovs/Work/summer-rising';
const cliPath = path.join(repoRoot, 'src', 'cli.ts');
const discoveryFixturePath = path.join(
  repoRoot,
  'artifacts',
  'discovery',
  'public-source-endpoints.json',
);

function spawnCli(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', cliPath, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (status, signal) => {
      resolve({ signal, status, stderr, stdout });
    });
  });
}

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

test('snapshot command captures timestamped Source Snapshots with program year metadata', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'summer-rising-snapshot-'));
  const fixturePath = path.join(tempRoot, 'public-source-endpoints.json');
  const outputRoot = path.join(tempRoot, 'artifacts');
  const capturedAt = '2026-05-14T10:30:00.000Z';

  const server = http.createServer((request, response) => {
    if (request.url === '/primary') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ sites: [{ id: 'ms-1', name: 'P.S. 1' }] }));
      return;
    }

    if (request.url === '/verification') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ schools: [{ dbn: '01M001', name: 'P.S. 1' }] }));
      return;
    }

    response.statusCode = 404;
    response.end('not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  fs.writeFileSync(
    fixturePath,
    JSON.stringify(
      {
        primary_sources: [
          {
            name: 'Primary fixture source',
            auth: 'public',
            url: `http://127.0.0.1:${port}/primary`,
            source_identifier: 'primary-fixture',
          },
        ],
        verification_sources: [
          {
            name: 'Verification fixture source',
            auth: 'public',
            url: `http://127.0.0.1:${port}/verification`,
            source_identifier: 'verification-fixture',
          },
        ],
      },
      null,
      2,
    ),
  );

  const result = await spawnCli(
    [
      'snapshot',
      '--fixture',
      fixturePath,
      '--output-root',
      outputRoot,
      '--captured-at',
      capturedAt,
    ],
    {
      env: {
        ...process.env,
        SUMMER_RISING_PROGRAM_YEAR: '2025',
      },
    },
  );

  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));

  assert.equal(result.status, 0, result.stderr);

  const manifestPath = path.join(outputRoot, 'source-snapshots', '2025', 'manifest.json');
  assert.equal(fs.existsSync(manifestPath), true, 'manifest missing');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.program_year, '2025');
  assert.equal(manifest.retrieved_at, capturedAt);
  assert.equal(Array.isArray(manifest.sources), true);
  assert.equal(manifest.sources.length, 2);

  for (const snapshot of manifest.sources) {
    assert.match(snapshot.raw_path, /^source-snapshots\/raw\/2025\//);
    assert.equal(typeof snapshot.source_identifier, 'string');
    assert.equal(typeof snapshot.url, 'string');

    const rawPath = path.join(outputRoot, snapshot.raw_path);
    assert.equal(fs.existsSync(rawPath), true, `${snapshot.name} raw snapshot missing`);
  }

  assert.equal(fs.existsSync(path.join(outputRoot, 'normalized', '2025')), false);
});

test('extract command reuses cached Source Snapshots without live network calls', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'summer-rising-extract-'));
  const fixturePath = path.join(tempRoot, 'public-source-endpoints.json');
  const outputRoot = path.join(tempRoot, 'artifacts');
  const capturedAt = '2026-05-14T11:00:00.000Z';

  const server = http.createServer((request, response) => {
    if (request.url === '/primary') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ sites: [{ id: 'ms-1', name: 'P.S. 1' }] }));
      return;
    }

    if (request.url === '/verification') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ schools: [{ dbn: '01M001', name: 'P.S. 1' }] }));
      return;
    }

    response.statusCode = 404;
    response.end('not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  fs.writeFileSync(
    fixturePath,
    JSON.stringify(
      {
        primary_sources: [
          {
            name: 'Primary fixture source',
            auth: 'public',
            url: `http://127.0.0.1:${port}/primary`,
            source_identifier: 'primary-fixture',
          },
        ],
        verification_sources: [
          {
            name: 'Verification fixture source',
            auth: 'public',
            url: `http://127.0.0.1:${port}/verification`,
            source_identifier: 'verification-fixture',
          },
        ],
      },
      null,
      2,
    ),
  );

  const snapshotResult = await spawnCli(
    [
      'snapshot',
      '--fixture',
      fixturePath,
      '--output-root',
      outputRoot,
      '--captured-at',
      capturedAt,
    ],
    {
      env: {
        ...process.env,
        SUMMER_RISING_PROGRAM_YEAR: '2025',
      },
    },
  );

  assert.equal(snapshotResult.status, 0, snapshotResult.stderr);
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));

  const extractResult = await spawnCli(
    [
      'extract',
      '--fixture',
      fixturePath,
      '--output-root',
      outputRoot,
    ],
    {
      env: {
        ...process.env,
        SUMMER_RISING_PROGRAM_YEAR: '2025',
      },
    },
  );

  assert.equal(extractResult.status, 0, extractResult.stderr);
  assert.match(extractResult.stdout, /Reused 2 cached Source Snapshots/);

  const normalizedPath = path.join(outputRoot, 'normalized', '2025', 'source-snapshots.json');
  assert.equal(fs.existsSync(normalizedPath), true, 'normalized snapshot artifact missing');

  const normalizedArtifact = JSON.parse(fs.readFileSync(normalizedPath, 'utf8'));
  assert.equal(normalizedArtifact.program_year, '2025');
  assert.equal(normalizedArtifact.sources.length, 2);
  assert.deepEqual(
    normalizedArtifact.sources.map((source) => source.name),
    ['Primary fixture source', 'Verification fixture source'],
  );
});

test('snapshot command uses low concurrency by default', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'summer-rising-rate-limit-'));
  const fixturePath = path.join(tempRoot, 'public-source-endpoints.json');
  const outputRoot = path.join(tempRoot, 'artifacts');

  let inflightRequests = 0;
  let maxInflightRequests = 0;

  const server = http.createServer((request, response) => {
    inflightRequests += 1;
    maxInflightRequests = Math.max(maxInflightRequests, inflightRequests);

    setTimeout(() => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ path: request.url }));
      inflightRequests -= 1;
    }, 50);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  fs.writeFileSync(
    fixturePath,
    JSON.stringify(
      {
        primary_sources: [
          {
            name: 'Primary one',
            auth: 'public',
            url: `http://127.0.0.1:${port}/primary-one`,
          },
          {
            name: 'Primary two',
            auth: 'public',
            url: `http://127.0.0.1:${port}/primary-two`,
          },
        ],
      },
      null,
      2,
    ),
  );

  const result = await spawnCli(
    ['snapshot', '--fixture', fixturePath, '--output-root', outputRoot, '--captured-at', '2026-05-14T12:00:00.000Z'],
    {
      env: {
        ...process.env,
        SUMMER_RISING_PROGRAM_YEAR: '2025',
      },
    },
  );

  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));

  assert.equal(result.status, 0, result.stderr);
  assert.equal(maxInflightRequests, 1);

  const manifestPath = path.join(outputRoot, 'source-snapshots', '2025', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.request_policy.concurrency, 1);
});
