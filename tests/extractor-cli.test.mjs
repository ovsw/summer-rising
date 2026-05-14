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

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  cells.push(current);
  return cells;
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
    assert.equal(row.school_verification.status, 'source only');
    assert.equal(row.school_verification.matched_by, null);
  }

  const csvPath = path.join(outputRoot, 'normalized', '2025', 'lead-dataset.csv');
  assert.equal(fs.existsSync(csvPath), true, 'lead dataset csv missing');

  const csvRows = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
  assert.equal(csvRows.length, leadArtifact.rows.length + 1);

  const header = parseCsvLine(csvRows[0]);
  assert.deepEqual(header, [
    'program_year',
    'retrieved_at',
    'source_name',
    'source_identifier',
    'source_url',
    'summer_rising_site_name',
    'district_name',
    'address',
    'city',
    'state',
    'zip',
    'summer_rising_site_grades',
    'summer_rising_site_serves_grade_k_5',
    'summer_rising_site_serves_grade_6_8',
    'summer_rising_site_serves_grade_9_12',
    'provider_name',
    'provider_normalized_name',
    'provider_grades',
    'provider_serves_grade_k_5',
    'provider_serves_grade_6_8',
    'provider_serves_grade_9_12',
    'provider_contact_name',
    'provider_contact_email',
    'provider_contact_phone_number',
    'provider_email',
    'provider_phone_number',
    'provider_website',
    'affiliated_school_name',
    'affiliated_school_dbn',
    'school_verification_status',
    'school_verification_matched_by',
    'school_verification_candidate_name',
    'school_verification_candidate_dbn',
    'school_verification_candidate_count',
    'summer_rising_site_id',
    'summer_rising_site_dbn',
    'summer_rising_building_code',
    'district_code',
    'admission_process',
    'program_id',
    'program_code',
    'portfolio_id',
  ]);

  const firstDataRow = parseCsvLine(csvRows[1]);
  assert.equal(firstDataRow[0], '2025');
  assert.equal(firstDataRow[4], `http://127.0.0.1:${port}/primary`);
  assert.equal(firstDataRow[7], '110 CHESTER STREET, BROOKLYN, NY 11212');
  assert.equal(firstDataRow[8], 'BROOKLYN');
  assert.equal(firstDataRow[9], 'NY');
  assert.equal(firstDataRow[10], '11212');

  const earlyChildhoodRow = csvRows
    .slice(1)
    .map(parseCsvLine)
    .find((row) => row[15] === 'District 75 Led Enrichment (from P.S. 999 Weird Grades School, 3K-2)');
  assert.ok(earlyChildhoodRow, 'expected early childhood provider row in csv');
  assert.equal(earlyChildhoodRow[21], '');
  assert.equal(earlyChildhoodRow[22], '');
  assert.equal(earlyChildhoodRow[23], '');
  assert.equal(earlyChildhoodRow[24], 'info@provider.example.org');
  assert.equal(earlyChildhoodRow[26], 'https://provider.example.org');
});

test('extract ignores metadata Primary Sources and captures paginated school list pages', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'summer-rising-pagination-'));
  const fixturePath = path.join(tempRoot, 'public-source-endpoints.json');
  const outputRoot = path.join(tempRoot, 'artifacts');
  const capturedAt = '2026-05-14T11:15:00.000Z';
  let port;

  const buildSite = ({ address, buildingCode, districtCode, id, name, providerName, schoolName }) => ({
    id,
    name,
    school: {
      name,
      dbn: `${districtCode}${buildingCode}SR`,
      district: {
        borough: 'Brooklyn',
        code: districtCode,
        name: `DISTRICT ${districtCode}`,
      },
      full_address: address,
    },
    programs: [
      {
        id: id + 1000,
        program: {
          code: `${buildingCode}SR1`,
          name: providerName,
        },
        name: providerName,
        provider_website: '',
        provider_email: '',
        provider_phone_number: '',
        site_contact_name: '',
        site_contact_email: '',
        site_contact_phone_number: '',
        grades_description: 'K to 5',
      },
    ],
    grades_description: 'K to 5',
    affiliated_schools: [schoolName],
    admission_process: 'SR',
    building_code: buildingCode,
  });

  const server = http.createServer((request, response) => {
    response.setHeader('content-type', 'application/json');

    if (request.url === '/en/api/v2/admissionprocesses') {
      response.end(
        JSON.stringify({
          count: 2,
          results: [{ name: 'Summer Rising' }, { name: 'High School' }],
        }),
      );
      return;
    }

    if (request.url === '/en/api/v2/schools/process/45/?page=1') {
      response.end(
        JSON.stringify({
          count: 2,
          next: `http://127.0.0.1:${port}/en/api/v2/schools/process/45/?page=2`,
          previous: null,
          results: [
            buildSite({
              address: '1 ALPHA STREET, BROOKLYN, NY 11201',
              buildingCode: 'K001',
              districtCode: '13',
              id: 1,
              name: 'Summer Rising at 1 ALPHA STREET (Brooklyn Heights)',
              providerName: 'Alpha Provider (from Alpha School, K-5)',
              schoolName: 'Alpha School',
            }),
          ],
        }),
      );
      return;
    }

    if (request.url === '/en/api/v2/schools/process/45/?page=2') {
      response.end(
        JSON.stringify({
          count: 2,
          next: null,
          previous: `http://127.0.0.1:${port}/en/api/v2/schools/process/45/?page=1`,
          results: [
            buildSite({
              address: '2 BRAVO STREET, BROOKLYN, NY 11202',
              buildingCode: 'K002',
              districtCode: '14',
              id: 2,
              name: 'Summer Rising at 2 BRAVO STREET (Williamsburg)',
              providerName: 'Bravo Provider (from Bravo School, K-5)',
              schoolName: 'Bravo School',
            }),
          ],
        }),
      );
      return;
    }

    if (request.url === '/en/api/v2/filters/process/45/') {
      response.end(JSON.stringify({ results: [{ name: 'Grade' }, { name: 'Subway' }] }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  ({ port } = server.address());

  fs.writeFileSync(
    fixturePath,
    JSON.stringify(
      {
        primary_sources: [
          {
            name: 'MySchools admission processes',
            auth: 'public',
            url: `http://127.0.0.1:${port}/en/api/v2/admissionprocesses`,
            source_identifier: 'myschools-admission-processes',
          },
          {
            name: 'MySchools Summer Rising school list',
            auth: 'public',
            url: `http://127.0.0.1:${port}/en/api/v2/schools/process/45/?page=1`,
            source_identifier: 'myschools-summer-rising-school-list',
          },
          {
            name: 'MySchools Summer Rising filters',
            auth: 'public',
            url: `http://127.0.0.1:${port}/en/api/v2/filters/process/45/`,
            source_identifier: 'myschools-summer-rising-filters',
          },
        ],
      },
      null,
      2,
    ),
  );

  const snapshotResult = await spawnCli(
    ['snapshot', '--fixture', fixturePath, '--output-root', outputRoot, '--captured-at', capturedAt],
    {
      env: {
        ...process.env,
        SUMMER_RISING_PROGRAM_YEAR: '2026',
      },
    },
  );
  assert.equal(snapshotResult.status, 0, snapshotResult.stderr);

  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));

  const extractResult = await spawnCli(['extract', '--fixture', fixturePath, '--output-root', outputRoot], {
    env: {
      ...process.env,
      SUMMER_RISING_PROGRAM_YEAR: '2026',
    },
  });
  assert.equal(extractResult.status, 0, extractResult.stderr);

  const manifest = JSON.parse(
    fs.readFileSync(path.join(outputRoot, 'source-snapshots', '2026', 'manifest.json'), 'utf8'),
  );
  const schoolListSnapshot = manifest.sources.find(
    (source) => source.source_identifier === 'myschools-summer-rising-school-list',
  );
  const schoolListRaw = JSON.parse(fs.readFileSync(path.join(outputRoot, schoolListSnapshot.raw_path), 'utf8'));
  assert.deepEqual(schoolListRaw.page_urls, [
    `http://127.0.0.1:${port}/en/api/v2/schools/process/45/?page=1`,
    `http://127.0.0.1:${port}/en/api/v2/schools/process/45/?page=2`,
  ]);
  assert.equal(schoolListRaw.response_body.results.length, 2);

  const csvPath = path.join(outputRoot, 'normalized', '2026', 'lead-dataset.csv');
  const csvRows = fs.readFileSync(csvPath, 'utf8').trim().split('\n').map(parseCsvLine);
  const header = csvRows[0];
  const rows = csvRows.slice(1);
  const sourceNameIndex = header.indexOf('source_name');
  const siteNameIndex = header.indexOf('summer_rising_site_name');

  assert.equal(rows.length, 2);
  assert.deepEqual(new Set(rows.map((row) => row[sourceNameIndex])), new Set(['MySchools Summer Rising school list']));
  assert.deepEqual(rows.map((row) => row[siteNameIndex]), [
    'Summer Rising at 1 ALPHA STREET (Brooklyn Heights)',
    'Summer Rising at 2 BRAVO STREET (Williamsburg)',
  ]);
});

test('extract command assigns school verification statuses without removing Lead Rows', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'summer-rising-school-verification-'));
  const fixturePath = path.join(tempRoot, 'public-source-endpoints.json');
  const outputRoot = path.join(tempRoot, 'artifacts');
  const capturedAt = '2026-05-14T11:30:00.000Z';

  const server = http.createServer((request, response) => {
    response.setHeader('content-type', 'application/json');

    if (request.url === '/primary') {
      response.end(
        JSON.stringify({
          count: 5,
          results: [
            {
              id: 1001,
              name: 'Exact Match Summer Rising Site',
              school: {
                name: 'Exact Match Summer Rising Site',
                dbn: '01M100SR',
                district: {
                  borough: 'Manhattan',
                  code: '1',
                  name: 'DISTRICT 1',
                },
                full_address: '100 Exact Street, New York, NY 10002',
              },
              programs: [
                {
                  id: 2001,
                  program: {
                    code: 'M100SREX1',
                    name: 'Exact Provider',
                  },
                  grades_description: '6 to 8',
                },
              ],
              grades_description: '6 to 8',
              affiliated_schools: [{ name: 'Exact Match Academy', dbn: '01M001' }],
              admission_process: 'SR',
              building_code: 'M100',
            },
            {
              id: 1002,
              name: 'Address Match Summer Rising Site',
              school: {
                name: 'Address Match Summer Rising Site',
                dbn: '02M200SR',
                district: {
                  borough: 'Brooklyn',
                  code: '2',
                  name: 'DISTRICT 2',
                },
                full_address: '200 Address Avenue, Brooklyn, NY 11212',
              },
              programs: [
                {
                  id: 2002,
                  program: {
                    code: 'M200SRAD1',
                    name: 'Address Provider',
                  },
                  grades_description: 'K to 5',
                },
              ],
              grades_description: 'K to 5',
              affiliated_schools: ['Address Match Academy'],
              admission_process: 'SR',
              building_code: 'K200',
            },
            {
              id: 1003,
              name: 'Suggested Match Summer Rising Site',
              school: {
                name: 'Suggested Match Summer Rising Site',
                dbn: '03M300SR',
                district: {
                  borough: 'Queens',
                  code: '3',
                  name: 'DISTRICT 3',
                },
                full_address: '300 Suggestion Road, Queens, NY 11101',
              },
              programs: [
                {
                  id: 2003,
                  program: {
                    code: 'Q300SRSG1',
                    name: 'Suggested Provider',
                  },
                  grades_description: '6 to 8',
                },
              ],
              grades_description: '6 to 8',
              affiliated_schools: ['P.S. 999 Weird Grades School'],
              admission_process: 'SR',
              building_code: 'Q300',
            },
            {
              id: 1004,
              name: 'Needs Review Summer Rising Site',
              school: {
                name: 'Needs Review Summer Rising Site',
                dbn: '04M400SR',
                district: {
                  borough: 'Bronx',
                  code: '4',
                  name: 'DISTRICT 4',
                },
                full_address: '400 Review Boulevard, Bronx, NY 10451',
              },
              programs: [
                {
                  id: 2004,
                  program: {
                    code: 'X400SRNR1',
                    name: 'Review Provider',
                  },
                  grades_description: '9 to 12',
                },
              ],
              grades_description: '9 to 12',
              affiliated_schools: ['Harriet Tubman Academy'],
              admission_process: 'SR',
              building_code: 'X400',
            },
            {
              id: 1005,
              name: 'Source Only Summer Rising Site',
              school: {
                name: 'Source Only Summer Rising Site',
                dbn: '05M500SR',
                district: {
                  borough: 'Staten Island',
                  code: '5',
                  name: 'DISTRICT 5',
                },
                full_address: '500 Source Way, Staten Island, NY 10301',
              },
              programs: [
                {
                  id: 2005,
                  program: {
                    code: 'R500SRSO1',
                    name: 'Source Only Provider',
                  },
                  grades_description: 'K to 5',
                },
              ],
              grades_description: 'K to 5',
              affiliated_schools: ['No Match Academy'],
              admission_process: 'SR',
              building_code: 'R500',
            },
          ],
        }),
      );
      return;
    }

    if (request.url === '/verification') {
      response.end(
        JSON.stringify({
          results: [
            {
              id: 9001,
              name: 'Completely Different Name',
              dbn: '01M001',
              address: '999 Wrong Street, New York, NY 10013',
              borough: 'Manhattan',
              zip: '10013',
            },
            {
              id: 9002,
              name: 'Address Match Academy',
              dbn: '02M222',
              address: '200 Address Avenue, Brooklyn, NY 11212',
              borough: 'Brooklyn',
              zip: '11212',
            },
            {
              id: 9003,
              name: 'P S 999 Weird Grade School',
              dbn: '75K999',
            },
            {
              id: 9004,
              name: 'Harriet Tubman Acad',
              dbn: '08X111',
            },
            {
              id: 9005,
              name: 'Harriet Tubman Academy at PS 41',
              dbn: '08X112',
            },
          ],
        }),
      );
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

  const extractResult = await spawnCli(['extract', '--fixture', fixturePath, '--output-root', outputRoot], {
    env: {
      ...process.env,
      SUMMER_RISING_PROGRAM_YEAR: '2025',
    },
  });

  assert.equal(extractResult.status, 0, extractResult.stderr);

  const leadRowsPath = path.join(outputRoot, 'normalized', '2025', 'lead-rows.json');
  const leadArtifact = JSON.parse(fs.readFileSync(leadRowsPath, 'utf8'));
  assert.equal(leadArtifact.rows.length, 5);

  const rowsBySchoolName = new Map(
    leadArtifact.rows.map((row) => [row.affiliated_school.display_values.name, row]),
  );

  assert.equal(rowsBySchoolName.get('Exact Match Academy').school_verification.status, 'verified');
  assert.equal(
    rowsBySchoolName.get('Exact Match Academy').school_verification.matched_by,
    'exact public id/code',
  );
  assert.equal(rowsBySchoolName.get('Exact Match Academy').school_verification.candidate.dbn, '01M001');

  assert.equal(rowsBySchoolName.get('Address Match Academy').school_verification.status, 'verified');
  assert.equal(
    rowsBySchoolName.get('Address Match Academy').school_verification.matched_by,
    'normalized address plus borough/zip',
  );
  assert.equal(rowsBySchoolName.get('Address Match Academy').school_verification.candidate.dbn, '02M222');

  assert.equal(rowsBySchoolName.get('P.S. 999 Weird Grades School').school_verification.status, 'suggested match');
  assert.equal(rowsBySchoolName.get('P.S. 999 Weird Grades School').school_verification.matched_by, 'fuzzy name');
  assert.equal(
    rowsBySchoolName.get('P.S. 999 Weird Grades School').school_verification.candidate.dbn,
    '75K999',
  );

  assert.equal(rowsBySchoolName.get('Harriet Tubman Academy').school_verification.status, 'needs review');
  assert.equal(rowsBySchoolName.get('Harriet Tubman Academy').school_verification.matched_by, 'fuzzy name');
  assert.equal(rowsBySchoolName.get('Harriet Tubman Academy').school_verification.candidate_count, 2);

  assert.equal(rowsBySchoolName.get('No Match Academy').school_verification.status, 'source only');
  assert.equal(rowsBySchoolName.get('No Match Academy').school_verification.matched_by, null);
  assert.equal(rowsBySchoolName.get('No Match Academy').school_verification.candidate, null);
});

test('extract command marks school verification missing when Verification Source data is unavailable', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'summer-rising-school-verification-missing-'));
  const fixturePath = path.join(tempRoot, 'public-source-endpoints.json');
  const outputRoot = path.join(tempRoot, 'artifacts');
  const capturedAt = '2026-05-14T11:45:00.000Z';

  const server = http.createServer((request, response) => {
    if (request.url === '/primary') {
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          count: 1,
          results: [
            {
              id: 1100,
              name: 'Missing Verification Site',
              school: {
                name: 'Missing Verification Site',
                dbn: '10X100SR',
                district: {
                  borough: 'Bronx',
                  code: '10',
                  name: 'DISTRICT 10',
                },
                full_address: '10 Missing Plaza, Bronx, NY 10468',
              },
              programs: [
                {
                  id: 2100,
                  program: {
                    code: 'X100SRMS1',
                    name: 'Missing Verification Provider',
                  },
                  grades_description: '6 to 8',
                },
              ],
              grades_description: '6 to 8',
              affiliated_schools: ['Missing Verification Academy'],
              admission_process: 'SR',
              building_code: 'X100',
            },
          ],
        }),
      );
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

  const extractResult = await spawnCli(['extract', '--fixture', fixturePath, '--output-root', outputRoot], {
    env: {
      ...process.env,
      SUMMER_RISING_PROGRAM_YEAR: '2025',
    },
  });

  assert.equal(extractResult.status, 0, extractResult.stderr);

  const leadRowsPath = path.join(outputRoot, 'normalized', '2025', 'lead-rows.json');
  const leadArtifact = JSON.parse(fs.readFileSync(leadRowsPath, 'utf8'));
  assert.equal(leadArtifact.rows.length, 1);
  assert.equal(leadArtifact.rows[0].school_verification.status, 'missing');
  assert.equal(leadArtifact.rows[0].school_verification.matched_by, null);
  assert.equal(leadArtifact.rows[0].school_verification.candidate, null);
  assert.equal(leadArtifact.rows[0].school_verification.candidate_count, 0);
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
