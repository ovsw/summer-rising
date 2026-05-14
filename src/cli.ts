import fs from 'node:fs';
import path from 'node:path';

const repoRoot = '/Users/ovs/Work/summer-rising';
const supportedCommands = ['inspect', 'snapshot', 'extract', 'validate'] as const;
type SupportedCommand = (typeof supportedCommands)[number];
type SourceKind = 'Primary Source' | 'Verification Source';
type DiscoverySource = {
  auth?: string;
  name?: string;
  source_identifier?: string;
  url?: string;
};
type DiscoveryFixture = {
  primary_sources?: DiscoverySource[];
  verification_sources?: DiscoverySource[];
};
type SourceSnapshotManifest = {
  program_year: string;
  retrieved_at: string;
  sources: Array<{
    name: string;
    raw_path: string;
    source_identifier: string;
    source_kind: SourceKind;
    url: string;
  }>;
};
type ParsedPrimarySourceArtifact = {
  fixture_path: string;
  program_year: string;
  records: ParsedPrimarySourceRecord[];
  retrieved_at: string;
};
type ParsedPrimarySourceRecord = {
  affiliated_schools: Array<{
    display_values: {
      name: string | null;
    };
    public_ids: {
      affiliated_school_dbn: null;
    };
  }>;
  providers: Array<{
    description: string | null;
    display_values: {
      end_date: string | null;
      end_time: string | null;
      grades_description: string | null;
      name: string | null;
      start_date: string | null;
      start_time: string | null;
    };
    email: string | null;
    phone_number: string | null;
    provider_contact: {
      email: string | null;
      name: string | null;
      phone_number: string | null;
    };
    public_ids: {
      portfolio_id: string | null;
      program_code: string | null;
      program_id: number | null;
    };
    website: string | null;
  }>;
  source: {
    raw_path: string;
    source_identifier: string;
    source_name: string;
    url: string;
  };
  summer_rising_site: {
    display_values: {
      accessibility: string | null;
      borough: string | null;
      district_name: string | null;
      full_address: string | null;
      grades_description: string | null;
      name: string | null;
      school_year: string | null;
    };
    public_ids: {
      admission_process: string | null;
      building_code: string | null;
      district_code: string | null;
      site_dbn: string | null;
      site_id: number | null;
    };
  };
};

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const options = new Map<string, string>();

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    const nextToken = rest[index + 1];

    if (token?.startsWith('--') && nextToken && !nextToken.startsWith('--')) {
      options.set(token.slice(2), nextToken);
      index += 1;
    }
  }

  return {
    command,
    options,
  };
}

function printUsage() {
  console.log('summer-rising-extractor commands');
  for (const command of supportedCommands) {
    console.log(`- ${command}`);
  }
}

function resolveFixturePath(input: string | undefined) {
  if (!input) {
    return path.join(repoRoot, 'artifacts', 'discovery', 'public-source-endpoints.json');
  }

  return path.isAbsolute(input) ? input : path.join(repoRoot, input);
}

function resolveOutputRoot(input: string | undefined) {
  if (!input) {
    return path.join(repoRoot, 'artifacts');
  }

  return path.isAbsolute(input) ? input : path.join(repoRoot, input);
}

function requireProgramYear() {
  const programYear = process.env.SUMMER_RISING_PROGRAM_YEAR;
  if (!programYear) {
    throw new Error('Missing required env var SUMMER_RISING_PROGRAM_YEAR.');
  }

  return programYear;
}

function loadFixture(fixturePath: string) {
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as DiscoveryFixture;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function resolveCapturedAt(input: string | undefined) {
  return input ?? new Date().toISOString();
}

function ensureDirectory(directoryPath: string) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function resolveSnapshotManifestPath(outputRoot: string, programYear: string) {
  return path.join(outputRoot, 'source-snapshots', programYear, 'manifest.json');
}

function resolveParsedPrimarySourcePath(outputRoot: string, programYear: string) {
  return path.join(outputRoot, 'parsed', programYear, 'primary-source-records.json');
}

function runInspect(fixturePath: string) {
  const fixture = loadFixture(fixturePath);

  printUsage();
  console.log(`Fixture: ${path.relative(repoRoot, fixturePath)}`);
  console.log(`Primary Sources: ${fixture.primary_sources?.length ?? 0}`);
  console.log(`Verification Sources: ${fixture.verification_sources?.length ?? 0}`);
  console.log('Source Snapshot workflow ready.');
}

async function captureSourceSnapshot(args: {
  capturedAt: string;
  outputRoot: string;
  programYear: string;
  source: DiscoverySource;
  sourceKind: SourceKind;
}) {
  const { capturedAt, outputRoot, programYear, source, sourceKind } = args;
  const url = source.url;

  if (source.auth !== 'public') {
    throw new Error(`Snapshot capture only supports public sources. Received auth=${source.auth ?? 'missing'}.`);
  }

  if (!url) {
    throw new Error(`Snapshot source ${source.name ?? 'unknown'} is missing a url.`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Snapshot request failed for ${url}: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
  const bodyText = await response.text();
  let responseBody: unknown = bodyText;

  if (contentType.includes('application/json')) {
    responseBody = JSON.parse(bodyText);
  }

  const rawDirectory = path.join(outputRoot, 'source-snapshots', 'raw', programYear);
  ensureDirectory(rawDirectory);

  const datePrefix = capturedAt.slice(0, 10);
  const slug = slugify(source.source_identifier ?? source.name ?? url);
  const fileName = `${datePrefix}-${slug}.json`;
  const rawPath = path.join(rawDirectory, fileName);

  fs.writeFileSync(
    rawPath,
    JSON.stringify(
      {
        name: source.name ?? slug,
        program_year: programYear,
        response_body: responseBody,
        retrieved_at: capturedAt,
        source_identifier: source.source_identifier ?? null,
        source_kind: sourceKind,
        url,
      },
      null,
      2,
    ),
  );

  return {
    name: source.name ?? slug,
    raw_path: path.relative(outputRoot, rawPath),
    retrieved_at: capturedAt,
    source_identifier: source.source_identifier ?? slug,
    source_kind: sourceKind,
    url,
  };
}

async function runSnapshot(args: {
  capturedAt: string;
  fixturePath: string;
  outputRoot: string;
  programYear: string;
}) {
  const { capturedAt, fixturePath, outputRoot, programYear } = args;
  const fixture = loadFixture(fixturePath);
  const sources = [
    ...(fixture.primary_sources ?? []).map((source) => ({ source, sourceKind: 'Primary Source' as const })),
    ...(fixture.verification_sources ?? []).map((source) => ({
      source,
      sourceKind: 'Verification Source' as const,
    })),
  ];

  const manifestSources = [];
  for (const entry of sources) {
    manifestSources.push(
      await captureSourceSnapshot({
        capturedAt,
        outputRoot,
        programYear,
        source: entry.source,
        sourceKind: entry.sourceKind,
      }),
    );
  }

  const manifestDirectory = path.join(outputRoot, 'source-snapshots', programYear);
  ensureDirectory(manifestDirectory);

  const manifestPath = path.join(manifestDirectory, 'manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        program_year: programYear,
        request_policy: {
          concurrency: 1,
        },
        retrieved_at: capturedAt,
        sources: manifestSources,
      },
      null,
      2,
    ),
  );

  console.log(`Captured ${manifestSources.length} Source Snapshots for program year ${programYear}.`);
}

function runExtract(args: { fixturePath: string; outputRoot: string }) {
  const { fixturePath, outputRoot } = args;
  const programYear = requireProgramYear();
  const manifestPath = resolveSnapshotManifestPath(outputRoot, programYear);

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Missing Source Snapshot manifest for program year ${programYear}. Run snapshot first at ${path.relative(repoRoot, manifestPath)}.`,
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as SourceSnapshotManifest;
  const primarySources = manifest.sources.filter((source) => source.source_kind === 'Primary Source');
  const records = primarySources.flatMap((source) => {
    const rawPath = path.join(outputRoot, source.raw_path);
    const rawSnapshot = JSON.parse(fs.readFileSync(rawPath, 'utf8')) as {
      response_body: unknown;
    };

    return parsePrimarySourceSnapshot({
      rawPath: source.raw_path,
      responseBody: rawSnapshot.response_body,
      sourceIdentifier: source.source_identifier,
      sourceName: source.name,
      url: source.url,
    });
  });

  const parsedPath = resolveParsedPrimarySourcePath(outputRoot, programYear);
  ensureDirectory(path.dirname(parsedPath));
  fs.writeFileSync(
    parsedPath,
    JSON.stringify(
      satisfiesParsedPrimarySourceArtifact({
        fixture_path: path.relative(outputRoot, fixturePath),
        program_year: manifest.program_year,
        retrieved_at: manifest.retrieved_at,
        records,
      }),
      null,
      2,
    ),
  );

  console.log(
    `Parsed ${records.length} Primary Source records from ${primarySources.length} cached Source Snapshots for program year ${programYear}.`,
  );
}

function parsePrimarySourceSnapshot(args: {
  rawPath: string;
  responseBody: unknown;
  sourceIdentifier: string;
  sourceName: string;
  url: string;
}) {
  const { rawPath, responseBody, sourceIdentifier, sourceName, url } = args;
  const results = readArray(readObject(responseBody).results);

  return results.map((rawRecord) =>
    parsePrimarySourceRecord(rawRecord, {
      raw_path: rawPath,
      source_identifier: sourceIdentifier,
      source_name: sourceName,
      url,
    }),
  );
}

function parsePrimarySourceRecord(
  rawRecord: unknown,
  source: ParsedPrimarySourceRecord['source'],
): ParsedPrimarySourceRecord {
  const record = readObject(rawRecord);
  const school = readObject(record.school);
  const district = readObject(school.district);
  const programs = readArray(record.programs).map(parseProgramRecord);
  const affiliatedSchools = readArray(record.affiliated_schools)
    .map((value) => normalizeOptionalString(value))
    .map((name) => ({
      display_values: { name },
      public_ids: { affiliated_school_dbn: null },
    }));

  return {
    source,
    summer_rising_site: {
      display_values: {
        accessibility: normalizeOptionalString(school.accessibility),
        borough: normalizeOptionalString(district.borough),
        district_name: normalizeOptionalString(district.name),
        full_address: normalizeOptionalString(school.full_address),
        grades_description: normalizeOptionalString(record.grades_description),
        name: normalizeOptionalString(record.name),
        school_year: normalizeOptionalString(school.school_year),
      },
      public_ids: {
        admission_process: normalizeOptionalString(record.admission_process),
        building_code: normalizeOptionalString(record.building_code),
        district_code: normalizeOptionalString(district.code),
        site_dbn: normalizeOptionalString(school.dbn),
        site_id: normalizeOptionalNumber(record.id),
      },
    },
    affiliated_schools: affiliatedSchools,
    providers: programs,
  };
}

function parseProgramRecord(rawProgram: unknown): ParsedPrimarySourceRecord['providers'][number] {
  const program = readObject(rawProgram);
  const nestedProgram = readObject(program.program);

  return {
    description: normalizeOptionalString(program.description),
    display_values: {
      end_date: normalizeOptionalString(program.end_date),
      end_time: normalizeOptionalString(program.end_time),
      grades_description: normalizeOptionalString(program.grades_description),
      name: normalizeOptionalString(program.name ?? nestedProgram.name),
      start_date: normalizeOptionalString(program.start_date),
      start_time: normalizeOptionalString(program.start_time),
    },
    email: normalizeOptionalString(program.provider_email),
    phone_number: normalizeOptionalString(program.provider_phone_number),
    provider_contact: {
      email: normalizeOptionalString(program.site_contact_email),
      name: normalizeOptionalString(program.site_contact_name),
      phone_number: normalizeOptionalString(program.site_contact_phone_number),
    },
    public_ids: {
      portfolio_id: normalizeOptionalString(program.portfolio_id),
      program_code: normalizeOptionalString(nestedProgram.code),
      program_id: normalizeOptionalNumber(program.id),
    },
    website: normalizeOptionalString(program.provider_website),
  };
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function readObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  return value.trim() === '' ? null : value;
}

function normalizeOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function satisfiesParsedPrimarySourceArtifact(value: ParsedPrimarySourceArtifact) {
  return value;
}

function runValidate(fixturePath: string) {
  const programYear = requireProgramYear();
  console.log(
    `Validate command ready for program year ${programYear} with fixture ${path.relative(repoRoot, fixturePath)}.`,
  );
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const fixturePath = resolveFixturePath(options.get('fixture'));
  const outputRoot = resolveOutputRoot(options.get('output-root'));
  const capturedAt = resolveCapturedAt(options.get('captured-at'));

  if (!command || !supportedCommands.includes(command as SupportedCommand)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  switch (command as SupportedCommand) {
    case 'inspect':
      runInspect(fixturePath);
      break;
    case 'snapshot':
      await runSnapshot({
        capturedAt,
        fixturePath,
        outputRoot,
        programYear: requireProgramYear(),
      });
      break;
    case 'extract':
      runExtract({ fixturePath, outputRoot });
      break;
    case 'validate':
      runValidate(fixturePath);
      break;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
