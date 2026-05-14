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
      response.end(
        JSON.stringify({
          count: 1,
          results: [
            {
              id: 110929,
              name: 'District 75 Led Enrichment at 110 CHESTER STREET (Brownsville)',
              school: {
                name: 'District 75 Led Enrichment at 110 CHESTER STREET (Brownsville)',
                dbn: '23K396SR',
                accessibility: 'Fully Accessible',
                school_year: '2025-26 School Year',
                district: {
                  borough: 'Brooklyn',
                  code: '23',
                  name: 'DISTRICT 23',
                },
                full_address: '110 CHESTER STREET, BROOKLYN, NY 11212',
              },
              programs: [
                {
                  id: 128038,
                  program: {
                    code: 'K396SRMS1',
                    name: 'District 75 Led Enrichment (from Sid Miller Academy, 6-8)',
                  },
                  name: 'District 75 Led Enrichment (from Sid Miller Academy, 6-8)',
                  description: 'District 75 middle school program',
                  start_date: '2026-07-01',
                  end_date: '2026-08-07',
                  start_time: '8:00am',
                  end_time: '6:00pm',
                  provider_website: '',
                  provider_email: '',
                  provider_phone_number: '',
                  site_contact_name: 'Chana Max',
                  site_contact_email: 'cmax@schools.nyc.gov',
                  site_contact_phone_number: '(718) 385-6200',
                  portfolio_id: 'K396SR2',
                  grades_description: '6 to 8',
                },
                {
                  id: 128037,
                  program: {
                    code: 'K396SRES1',
                    name: 'District 75 Led Enrichment (from P.S. 999 Weird Grades School, 3K-2)',
                  },
                  name: 'District 75 Led Enrichment (from P.S. 999 Weird Grades School, 3K-2)',
                  description: 'District 75 early childhood program',
                  start_date: '2026-07-01',
                  end_date: '2026-08-14',
                  start_time: '9:00am',
                  end_time: '3:00pm',
                  provider_website: 'https://provider.example.org',
                  provider_email: 'info@provider.example.org',
                  provider_phone_number: '212-555-0000',
                  site_contact_name: '',
                  site_contact_email: '',
                  site_contact_phone_number: '',
                  portfolio_id: 'K396SR1',
                  grades_description: '3K to 2',
                },
              ],
              grades_description: 'K to 5; 6 to 8; 3K to 2',
              other_features: [],
              affiliated_schools: ['Sid Miller Academy (K-8)', 'P.S. 999 Weird Grades School'],
              admission_process: 'SR',
              building_code: 'K396',
            },
          ],
        }),
      );
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
  assert.match(extractResult.stdout, /Parsed 1 Primary Source records from 1 cached Source Snapshots/);

  const parsedPath = path.join(outputRoot, 'parsed', '2025', 'primary-source-records.json');
  assert.equal(fs.existsSync(parsedPath), true, 'parsed source record artifact missing');

  const parsedArtifact = JSON.parse(fs.readFileSync(parsedPath, 'utf8'));
  assert.equal(parsedArtifact.program_year, '2025');
  assert.equal(parsedArtifact.retrieved_at, capturedAt);
  assert.equal(parsedArtifact.records.length, 1);
  assert.equal('sources' in parsedArtifact, false);

  const [record] = parsedArtifact.records;
  assert.equal(record.source.source_identifier, 'primary-fixture');
  assert.equal(record.summer_rising_site.display_values.name, 'District 75 Led Enrichment at 110 CHESTER STREET (Brownsville)');
  assert.equal(record.summer_rising_site.display_values.grades_description, 'K to 5; 6 to 8; 3K to 2');
  assert.equal(record.summer_rising_site.public_ids.site_id, 110929);
  assert.equal(record.summer_rising_site.public_ids.site_dbn, '23K396SR');
  assert.equal(record.summer_rising_site.public_ids.building_code, 'K396');

  assert.deepEqual(
    record.affiliated_schools.map((school) => school.display_values.name),
    ['Sid Miller Academy (K-8)', 'P.S. 999 Weird Grades School'],
  );

  assert.equal(record.providers.length, 2);
  assert.equal(
    record.providers[0].display_values.name,
    'District 75 Led Enrichment (from Sid Miller Academy, 6-8)',
  );
  assert.equal(record.providers[0].display_values.grades_description, '6 to 8');
  assert.equal(record.providers[0].public_ids.program_id, 128038);
  assert.equal(record.providers[0].public_ids.program_code, 'K396SRMS1');
  assert.equal(record.providers[0].public_ids.portfolio_id, 'K396SR2');
  assert.equal(record.providers[0].website, null);
  assert.equal(record.providers[0].email, null);
  assert.equal(record.providers[0].phone_number, null);
  assert.equal(record.providers[0].provider_contact.name, 'Chana Max');
  assert.equal(record.providers[0].provider_contact.email, 'cmax@schools.nyc.gov');
  assert.equal(record.providers[0].provider_contact.phone_number, '(718) 385-6200');

  assert.equal(
    record.providers[1].display_values.name,
    'District 75 Led Enrichment (from P.S. 999 Weird Grades School, 3K-2)',
  );
  assert.equal(record.providers[1].display_values.grades_description, '3K to 2');
  assert.equal(record.providers[1].website, 'https://provider.example.org');
  assert.equal(record.providers[1].email, 'info@provider.example.org');
  assert.equal(record.providers[1].phone_number, '212-555-0000');
  assert.equal(record.providers[1].provider_contact.name, null);
  assert.equal(record.providers[1].provider_contact.email, null);
  assert.equal(record.providers[1].provider_contact.phone_number, null);

  const leadRowsPath = path.join(outputRoot, 'normalized', '2025', 'lead-rows.json');
  assert.equal(fs.existsSync(leadRowsPath), true, 'lead row artifact missing');

  const leadArtifact = JSON.parse(fs.readFileSync(leadRowsPath, 'utf8'));
  assert.equal(leadArtifact.program_year, '2025');
  assert.equal(leadArtifact.retrieved_at, capturedAt);
  assert.equal(leadArtifact.rows.length, 4);

  const normalizedProviderNames = new Set();
  const affiliatedSchoolNames = new Set();

  for (const row of leadArtifact.rows) {
    assert.equal(row.program_year, '2025');
    assert.equal(row.retrieved_at, capturedAt);
    assert.equal(
      row.summer_rising_site.display_values.name,
      'District 75 Led Enrichment at 110 CHESTER STREET (Brownsville)',
    );
    assert.equal(row.summer_rising_site.public_ids.site_id, 110929);
    assert.equal(typeof row.provider.display_values.name, 'string');
    assert.equal(typeof row.provider.normalized_name, 'string');
    assert.equal(typeof row.affiliated_school.display_values.name, 'string');

    normalizedProviderNames.add(row.provider.normalized_name);
    affiliatedSchoolNames.add(row.affiliated_school.display_values.name);
  }

  assert.deepEqual(Array.from(normalizedProviderNames), ['district 75 led enrichment']);
  assert.deepEqual(Array.from(affiliatedSchoolNames).sort(), [
    'P.S. 999 Weird Grades School',
    'Sid Miller Academy (K-8)',
  ]);

  const middleSchoolRows = leadArtifact.rows.filter(
    (row) => row.provider.display_values.grades_description === '6 to 8',
  );
  assert.equal(middleSchoolRows.length, 2);
  assert.deepEqual(
    middleSchoolRows.map((row) => row.affiliated_school.display_values.name).sort(),
    ['P.S. 999 Weird Grades School', 'Sid Miller Academy (K-8)'],
  );

  for (const row of middleSchoolRows) {
    assert.equal(row.provider.public_ids.program_id, 128038);
    assert.equal(row.provider.public_ids.program_code, 'K396SRMS1');
    assert.equal(row.provider.public_ids.portfolio_id, 'K396SR2');
    assert.equal(row.provider.normalized_name, 'district 75 led enrichment');
    assert.equal(row.provider.grade_buckets.serves_grade_k_5, false);
    assert.equal(row.provider.grade_buckets.serves_grade_6_8, true);
    assert.equal(row.provider.grade_buckets.serves_grade_9_12, false);
    assert.equal(row.summer_rising_site.grade_buckets.serves_grade_k_5, true);
    assert.equal(row.summer_rising_site.grade_buckets.serves_grade_6_8, true);
    assert.equal(row.summer_rising_site.grade_buckets.serves_grade_9_12, false);
  }
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
