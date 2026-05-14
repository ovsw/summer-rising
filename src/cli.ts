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
type LeadRowArtifact = {
  program_year: string;
  retrieved_at: string;
  rows: LeadRow[];
};
type VerificationStatus =
  | 'missing'
  | 'needs review'
  | 'source only'
  | 'suggested match'
  | 'verified';
type ParsedPrimarySourceRecord = {
  affiliated_schools: Array<{
    display_values: {
      name: string | null;
    };
    public_ids: {
      affiliated_school_dbn: string | null;
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
type GradeBuckets = {
  serves_grade_6_8: boolean;
  serves_grade_9_12: boolean;
  serves_grade_k_5: boolean;
};
type AffiliatedSchool = ParsedPrimarySourceRecord['affiliated_schools'][number];
type LeadRow = {
  affiliated_schools: AffiliatedSchool[];
  program_year: string;
  provider: ParsedPrimarySourceRecord['providers'][number] & {
    grade_buckets: GradeBuckets;
    normalized_name: string | null;
  };
  retrieved_at: string;
  school_verification: SchoolVerification;
  source: ParsedPrimarySourceRecord['source'];
  summer_rising_site: ParsedPrimarySourceRecord['summer_rising_site'] & {
    grade_buckets: GradeBuckets;
  };
};
type VerificationCandidate = {
  address: string | null;
  borough: string | null;
  building_code: string | null;
  dbn: string | null;
  directory_school_id: number | null;
  name: string | null;
  postal_code: string | null;
  source_identifier: string;
  source_name: string;
};
type SchoolVerification = {
  affiliated_school_statuses: Array<{
    affiliated_school: AffiliatedSchool;
    school_verification: {
      candidate: VerificationCandidate | null;
      candidate_count: number;
      matched_by: 'exact public id/code' | 'fuzzy name' | 'normalized address plus borough/zip' | null;
      status: VerificationStatus;
    };
  }>;
  candidate: VerificationCandidate | null;
  candidate_count: number;
  matched_by: 'exact public id/code' | 'fuzzy name' | 'normalized address plus borough/zip' | null;
  status: VerificationStatus;
};
type RawSourceSnapshot = {
  page_urls?: string[];
  response_body: unknown;
};
const leadDatasetColumns = [
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
] as const;
type LeadDatasetColumn = (typeof leadDatasetColumns)[number];
type LeadDatasetCsvRow = Record<LeadDatasetColumn, string>;

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

function resolveLeadRowsPath(outputRoot: string, programYear: string) {
  return path.join(outputRoot, 'normalized', programYear, 'lead-rows.json');
}

function resolveLeadDatasetCsvPath(outputRoot: string, programYear: string) {
  return path.join(outputRoot, 'normalized', programYear, 'lead-dataset.csv');
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

  const fetched = await fetchSourceResponseBody({ sourceKind, url });

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
        page_urls: fetched.pageUrls,
        program_year: programYear,
        response_body: fetched.responseBody,
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

async function fetchSourceResponseBody(args: { sourceKind: SourceKind; url: string }) {
  const { sourceKind, url } = args;
  const firstPage = await fetchOneSourcePage(url);

  if (!shouldCaptureAllPages({ responseBody: firstPage.responseBody, sourceKind })) {
    return {
      pageUrls: [url],
      responseBody: firstPage.responseBody,
    };
  }

  const pageUrls = [url];
  const firstBody = readObject(firstPage.responseBody);
  const results = [...readArray(firstBody.results)];
  const seenUrls = new Set(pageUrls);
  let nextUrl = readNextPageUrl(firstBody.next, url);

  while (nextUrl) {
    if (seenUrls.has(nextUrl)) {
      throw new Error(`Pagination loop detected while fetching ${url}.`);
    }

    seenUrls.add(nextUrl);
    pageUrls.push(nextUrl);

    const nextPage = await fetchOneSourcePage(nextUrl);
    const nextBody = readObject(nextPage.responseBody);
    results.push(...readArray(nextBody.results));
    nextUrl = readNextPageUrl(nextBody.next, nextUrl);
  }

  return {
    pageUrls,
    responseBody: {
      ...firstBody,
      next: null,
      previous: null,
      results,
    },
  };
}

async function fetchOneSourcePage(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Snapshot request failed for ${url}: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
  const bodyText = await response.text();

  if (!contentType.includes('application/json')) {
    return {
      responseBody: bodyText as unknown,
    };
  }

  return {
    responseBody: JSON.parse(bodyText) as unknown,
  };
}

function shouldCaptureAllPages(args: { responseBody: unknown; sourceKind: SourceKind }) {
  return args.sourceKind === 'Primary Source' && hasSchoolListResults(args.responseBody);
}

function readNextPageUrl(value: unknown, currentUrl: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  return new URL(value, currentUrl).toString();
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
  const verificationSources = manifest.sources.filter((source) => source.source_kind === 'Verification Source');
  const records = primarySources.flatMap((source) => {
    const rawPath = path.join(outputRoot, source.raw_path);
    const rawSnapshot = JSON.parse(fs.readFileSync(rawPath, 'utf8')) as RawSourceSnapshot;

    return parsePrimarySourceSnapshot({
      rawPath: source.raw_path,
      responseBody: rawSnapshot.response_body,
      sourceIdentifier: source.source_identifier,
      sourceName: source.name,
      url: source.url,
    });
  });
  const verificationCandidates = verificationSources.flatMap((source) => {
    const rawPath = path.join(outputRoot, source.raw_path);
    const rawSnapshot = JSON.parse(fs.readFileSync(rawPath, 'utf8')) as RawSourceSnapshot;

    return parseVerificationSourceSnapshot({
      responseBody: rawSnapshot.response_body,
      sourceIdentifier: source.source_identifier,
      sourceName: source.name,
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

  const leadRows = records.flatMap((record) =>
    buildLeadRows({
      programYear: manifest.program_year,
      record,
      retrievedAt: manifest.retrieved_at,
      verificationCandidates,
    }),
  );

  const leadRowsPath = resolveLeadRowsPath(outputRoot, programYear);
  ensureDirectory(path.dirname(leadRowsPath));
  fs.writeFileSync(
    leadRowsPath,
    JSON.stringify(
      satisfiesLeadRowArtifact({
        program_year: manifest.program_year,
        retrieved_at: manifest.retrieved_at,
        rows: leadRows,
      }),
      null,
      2,
    ),
  );

  const leadDatasetCsvPath = resolveLeadDatasetCsvPath(outputRoot, programYear);
  fs.writeFileSync(leadDatasetCsvPath, serializeLeadDatasetCsv(leadRows));

  console.log(
    `Parsed ${records.length} Primary Source records from ${primarySources.length} cached Source Snapshots for program year ${programYear}.`,
  );
}

function buildLeadRows(args: {
  programYear: string;
  record: ParsedPrimarySourceRecord;
  retrievedAt: string;
  verificationCandidates: VerificationCandidate[];
}): LeadRow[] {
  const { programYear, record, retrievedAt, verificationCandidates } = args;
  const affiliatedSchools = record.affiliated_schools.length > 0
    ? record.affiliated_schools
    : [{ display_values: { name: null }, public_ids: { affiliated_school_dbn: null } }];
  const providers = record.providers.length > 0
    ? record.providers
    : [{
        description: null,
        display_values: {
          end_date: null,
          end_time: null,
          grades_description: null,
          name: null,
          start_date: null,
          start_time: null,
        },
        email: null,
        phone_number: null,
        provider_contact: {
          email: null,
          name: null,
          phone_number: null,
        },
        public_ids: {
          portfolio_id: null,
          program_code: null,
          program_id: null,
        },
        website: null,
      }];

  return providers.map((provider) => {
    const affiliatedSchoolStatuses = affiliatedSchools.map((affiliatedSchool) => ({
      affiliated_school: affiliatedSchool,
      school_verification: determineSchoolVerification({
        affiliatedSchool,
        summerRisingSite: record.summer_rising_site,
        verificationCandidates,
      }),
    }));

    return {
      affiliated_schools: affiliatedSchools,
      program_year: programYear,
      provider: {
        ...provider,
        grade_buckets: normalizeGradeBuckets(provider.display_values.grades_description),
        normalized_name: normalizeProviderName(provider.display_values.name),
      },
      retrieved_at: retrievedAt,
      school_verification: summarizeSchoolVerification(affiliatedSchoolStatuses),
      source: record.source,
      summer_rising_site: {
        ...record.summer_rising_site,
        grade_buckets: normalizeGradeBuckets(record.summer_rising_site.display_values.grades_description),
      },
    };
  });
}

function parsePrimarySourceSnapshot(args: {
  rawPath: string;
  responseBody: unknown;
  sourceIdentifier: string;
  sourceName: string;
  url: string;
}) {
  const { rawPath, responseBody, sourceIdentifier, sourceName, url } = args;
  if (!hasSchoolListResults(responseBody)) {
    return [];
  }

  const results = readArray(readObject(responseBody).results).filter(isSchoolListRecord);

  return results.map((rawRecord) =>
    parsePrimarySourceRecord(rawRecord, {
      raw_path: rawPath,
      source_identifier: sourceIdentifier,
      source_name: sourceName,
      url,
    }),
  );
}

function hasSchoolListResults(responseBody: unknown) {
  return readArray(readObject(responseBody).results).some(isSchoolListRecord);
}

function isSchoolListRecord(value: unknown) {
  const record = readObject(value);
  const school = readObject(record.school);
  return (
    Object.keys(school).length > 0 &&
    (Array.isArray(record.programs) ||
      Array.isArray(record.affiliated_schools) ||
      typeof record.building_code === 'string')
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
  const affiliatedSchools = readArray(record.affiliated_schools).map(parseAffiliatedSchool);

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

function parseAffiliatedSchool(
  rawAffiliatedSchool: unknown,
): ParsedPrimarySourceRecord['affiliated_schools'][number] {
  if (typeof rawAffiliatedSchool === 'string') {
    return {
      display_values: {
        name: normalizeOptionalString(rawAffiliatedSchool),
      },
      public_ids: {
        affiliated_school_dbn: null,
      },
    };
  }

  const school = readObject(rawAffiliatedSchool);

  return {
    display_values: {
      name: normalizeOptionalString(school.name),
    },
    public_ids: {
      affiliated_school_dbn: normalizeOptionalString(school.dbn),
    },
  };
}

function parseVerificationSourceSnapshot(args: {
  responseBody: unknown;
  sourceIdentifier: string;
  sourceName: string;
}): VerificationCandidate[] {
  const { responseBody, sourceIdentifier, sourceName } = args;
  const payload = readObject(responseBody);
  const results = readArray(payload.results).length > 0
    ? readArray(payload.results)
    : readArray(payload.schools);

  return results.map((rawCandidate) => {
    const candidate = readObject(rawCandidate);

    return {
      address: normalizeOptionalString(
        candidate.address ??
          candidate.full_address ??
          candidate.location ??
          candidate.street_address,
      ),
      borough: normalizeOptionalString(candidate.borough),
      building_code: normalizeOptionalString(candidate.building_code),
      dbn: normalizeOptionalString(candidate.dbn),
      directory_school_id: normalizeOptionalNumber(
        candidate.id ??
          candidate.school_id ??
          candidate.directory_school_id,
      ),
      name: normalizeOptionalString(
        candidate.name ??
          candidate.display_name ??
          candidate.school_name,
      ),
      postal_code: normalizeOptionalString(
        candidate.zip ??
          candidate.zip_code ??
          candidate.postal_code,
      ),
      source_identifier: sourceIdentifier,
      source_name: sourceName,
    };
  });
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

function normalizeProviderName(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeIdentifier(value: string | null) {
  if (!value) {
    return null;
  }

  return value.replace(/[^a-z0-9]+/gi, '').toUpperCase();
}

function normalizeSchoolName(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeAddress(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .toLowerCase()
    .replace(/\b(street|st)\b/g, 'st')
    .replace(/\b(avenue|ave)\b/g, 'ave')
    .replace(/\b(road|rd)\b/g, 'rd')
    .replace(/\b(boulevard|blvd)\b/g, 'blvd')
    .replace(/\b(place|pl)\b/g, 'pl')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function extractPostalCode(value: string | null) {
  const match = value?.match(/\b(\d{5})\b/);
  return match ? match[1] : null;
}

function scoreNameSimilarity(left: string | null, right: string | null) {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const leftTokens = new Set(left.split(' '));
  const rightTokens = new Set(right.split(' '));
  let intersectionCount = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersectionCount += 1;
    }
  }

  const unionCount = new Set([...leftTokens, ...rightTokens]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

function isFuzzyNameMatch(left: string | null, right: string | null) {
  if (!left || !right) {
    return false;
  }

  const similarity = scoreNameSimilarity(left, right);
  if (similarity >= 0.7) {
    return true;
  }

  const [leftFirstToken] = left.split(' ');
  const [rightFirstToken] = right.split(' ');
  return similarity >= 0.5 && leftFirstToken === rightFirstToken;
}

function determineSchoolVerification(args: {
  affiliatedSchool: ParsedPrimarySourceRecord['affiliated_schools'][number];
  summerRisingSite: ParsedPrimarySourceRecord['summer_rising_site'];
  verificationCandidates: VerificationCandidate[];
}): SchoolVerification {
  const { affiliatedSchool, summerRisingSite, verificationCandidates } = args;

  if (verificationCandidates.length === 0) {
    return {
      affiliated_school_statuses: [],
      candidate: null,
      candidate_count: 0,
      matched_by: null,
      status: 'missing',
    };
  }

  const exactIdentifiers = [
    affiliatedSchool.public_ids.affiliated_school_dbn,
    summerRisingSite.public_ids.site_dbn,
    summerRisingSite.public_ids.building_code,
  ]
    .map(normalizeIdentifier)
    .filter((value): value is string => value !== null);
  const exactMatches = verificationCandidates.filter((candidate) => {
    const candidateIdentifiers = [candidate.dbn, candidate.building_code]
      .map(normalizeIdentifier)
      .filter((value): value is string => value !== null);

    return candidateIdentifiers.some((identifier) => exactIdentifiers.includes(identifier));
  });

  if (exactMatches.length === 1) {
    return {
      affiliated_school_statuses: [],
      candidate: exactMatches[0],
      candidate_count: 1,
      matched_by: 'exact public id/code',
      status: 'verified',
    };
  }

  if (exactMatches.length > 1) {
    return {
      affiliated_school_statuses: [],
      candidate: exactMatches[0],
      candidate_count: exactMatches.length,
      matched_by: 'exact public id/code',
      status: 'needs review',
    };
  }

  const normalizedRowAddress = normalizeAddress(summerRisingSite.display_values.full_address);
  const normalizedRowBorough = normalizeSchoolName(summerRisingSite.display_values.borough);
  const rowPostalCode = extractPostalCode(summerRisingSite.display_values.full_address);
  const addressMatches = verificationCandidates.filter((candidate) => {
    const normalizedCandidateAddress = normalizeAddress(candidate.address);
    if (!normalizedRowAddress || !normalizedCandidateAddress || normalizedRowAddress !== normalizedCandidateAddress) {
      return false;
    }

    const boroughMatches =
      normalizedRowBorough !== null &&
      normalizeSchoolName(candidate.borough) === normalizedRowBorough;
    const postalCodeMatches = rowPostalCode !== null && candidate.postal_code === rowPostalCode;

    return boroughMatches || postalCodeMatches;
  });

  if (addressMatches.length === 1) {
    return {
      affiliated_school_statuses: [],
      candidate: addressMatches[0],
      candidate_count: 1,
      matched_by: 'normalized address plus borough/zip',
      status: 'verified',
    };
  }

  if (addressMatches.length > 1) {
    return {
      affiliated_school_statuses: [],
      candidate: addressMatches[0],
      candidate_count: addressMatches.length,
      matched_by: 'normalized address plus borough/zip',
      status: 'needs review',
    };
  }

  const normalizedSchoolName = normalizeSchoolName(affiliatedSchool.display_values.name);
  const fuzzyMatches = verificationCandidates.filter((candidate) => {
    const candidateName = normalizeSchoolName(candidate.name);
    return isFuzzyNameMatch(normalizedSchoolName, candidateName);
  });

  if (fuzzyMatches.length === 1) {
    return {
      affiliated_school_statuses: [],
      candidate: fuzzyMatches[0],
      candidate_count: 1,
      matched_by: 'fuzzy name',
      status: 'suggested match',
    };
  }

  if (fuzzyMatches.length > 1) {
    return {
      affiliated_school_statuses: [],
      candidate: fuzzyMatches[0],
      candidate_count: fuzzyMatches.length,
      matched_by: 'fuzzy name',
      status: 'needs review',
    };
  }

  return {
    affiliated_school_statuses: [],
    candidate: null,
    candidate_count: 0,
    matched_by: null,
    status: 'source only',
  };
}

function summarizeSchoolVerification(
  affiliatedSchoolStatuses: SchoolVerification['affiliated_school_statuses'],
): SchoolVerification {
  const highestActionStatus = [...affiliatedSchoolStatuses].sort((left, right) =>
    verificationStatusRank(right.school_verification.status) -
      verificationStatusRank(left.school_verification.status))[0]?.school_verification ?? {
        affiliated_school_statuses: [],
        candidate: null,
        candidate_count: 0,
        matched_by: null,
        status: 'missing' as const,
      };

  return {
    affiliated_school_statuses: affiliatedSchoolStatuses,
    candidate: highestActionStatus.candidate,
    candidate_count: highestActionStatus.candidate_count,
    matched_by: highestActionStatus.matched_by,
    status: highestActionStatus.status,
  };
}

function verificationStatusRank(value: VerificationStatus) {
  switch (value) {
    case 'needs review':
      return 5;
    case 'suggested match':
      return 4;
    case 'source only':
      return 3;
    case 'missing':
      return 2;
    case 'verified':
      return 1;
    default:
      return 0;
  }
}

function normalizeGradeBuckets(value: string | null): GradeBuckets {
  const normalized = value?.toLowerCase() ?? '';

  return {
    serves_grade_6_8: /(6\s*to\s*8|6-8)/.test(normalized),
    serves_grade_9_12: /(9\s*to\s*12|9-12)/.test(normalized),
    serves_grade_k_5: /(k\s*to\s*5|k-5|3k\s*to\s*2|pre-k\s*to\s*2|pk\s*to\s*2)/.test(normalized),
  };
}

function serializeLeadDatasetCsv(rows: LeadRow[]) {
  const serializedRows = [
    leadDatasetColumns.join(','),
    ...rows.map((row) =>
      leadDatasetColumns
        .map((column) => escapeCsvValue(toLeadDatasetCsvRow(row)[column]))
        .join(','),
    ),
  ];

  return `${serializedRows.join('\n')}\n`;
}

function toLeadDatasetCsvRow(row: LeadRow): LeadDatasetCsvRow {
  const addressParts = splitAddressParts(row.summer_rising_site.display_values.full_address);
  const affiliatedSchoolNames = row.affiliated_schools
    .map((school) => school.display_values.name)
    .filter((value): value is string => value !== null);
  const affiliatedSchoolDbns = row.affiliated_schools
    .map((school) => school.public_ids.affiliated_school_dbn)
    .filter((value): value is string => value !== null);

  return {
    program_year: row.program_year,
    retrieved_at: row.retrieved_at,
    source_name: row.source.source_name,
    source_identifier: row.source.source_identifier,
    source_url: row.source.url,
    summer_rising_site_name: formatCsvValue(row.summer_rising_site.display_values.name),
    district_name: formatCsvValue(row.summer_rising_site.display_values.district_name),
    address: formatCsvValue(row.summer_rising_site.display_values.full_address),
    city: formatCsvValue(addressParts.city),
    state: formatCsvValue(addressParts.state),
    zip: formatCsvValue(addressParts.zip),
    summer_rising_site_grades: formatCsvValue(row.summer_rising_site.display_values.grades_description),
    summer_rising_site_serves_grade_k_5: formatCsvBoolean(row.summer_rising_site.grade_buckets.serves_grade_k_5),
    summer_rising_site_serves_grade_6_8: formatCsvBoolean(row.summer_rising_site.grade_buckets.serves_grade_6_8),
    summer_rising_site_serves_grade_9_12: formatCsvBoolean(row.summer_rising_site.grade_buckets.serves_grade_9_12),
    provider_name: formatCsvValue(row.provider.display_values.name),
    provider_normalized_name: formatCsvValue(row.provider.normalized_name),
    provider_grades: formatCsvValue(row.provider.display_values.grades_description),
    provider_serves_grade_k_5: formatCsvBoolean(row.provider.grade_buckets.serves_grade_k_5),
    provider_serves_grade_6_8: formatCsvBoolean(row.provider.grade_buckets.serves_grade_6_8),
    provider_serves_grade_9_12: formatCsvBoolean(row.provider.grade_buckets.serves_grade_9_12),
    provider_contact_name: formatCsvValue(row.provider.provider_contact.name),
    provider_contact_email: formatCsvValue(row.provider.provider_contact.email),
    provider_contact_phone_number: formatCsvValue(row.provider.provider_contact.phone_number),
    provider_email: formatCsvValue(row.provider.email),
    provider_phone_number: formatCsvValue(row.provider.phone_number),
    provider_website: formatCsvValue(row.provider.website),
    affiliated_school_name: formatCsvValue(joinDelimitedValues(affiliatedSchoolNames)),
    affiliated_school_dbn: formatCsvValue(joinDelimitedValues(affiliatedSchoolDbns)),
    school_verification_status: row.school_verification.status,
    school_verification_matched_by: formatCsvValue(row.school_verification.matched_by),
    school_verification_candidate_name: formatCsvValue(row.school_verification.candidate?.name ?? null),
    school_verification_candidate_dbn: formatCsvValue(row.school_verification.candidate?.dbn ?? null),
    school_verification_candidate_count: String(row.school_verification.candidate_count),
    summer_rising_site_id: formatCsvNumber(row.summer_rising_site.public_ids.site_id),
    summer_rising_site_dbn: formatCsvValue(row.summer_rising_site.public_ids.site_dbn),
    summer_rising_building_code: formatCsvValue(row.summer_rising_site.public_ids.building_code),
    district_code: formatCsvValue(row.summer_rising_site.public_ids.district_code),
    admission_process: formatCsvValue(row.summer_rising_site.public_ids.admission_process),
    program_id: formatCsvNumber(row.provider.public_ids.program_id),
    program_code: formatCsvValue(row.provider.public_ids.program_code),
    portfolio_id: formatCsvValue(row.provider.public_ids.portfolio_id),
  };
}

function splitAddressParts(value: string | null) {
  if (!value) {
    return {
      city: null,
      state: null,
      zip: null,
    };
  }

  const match = value.match(/^(.*?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/i);
  if (!match) {
    return {
      city: null,
      state: null,
      zip: extractPostalCode(value),
    };
  }

  return {
    city: match[2].trim(),
    state: match[3].trim().toUpperCase(),
    zip: match[4].trim(),
  };
}

function formatCsvValue(value: string | null) {
  return value ?? '';
}

function formatCsvNumber(value: number | null) {
  return value === null ? '' : String(value);
}

function formatCsvBoolean(value: boolean) {
  return value ? 'true' : 'false';
}

function joinDelimitedValues(values: string[]) {
  return values.length === 0 ? null : values.join(' | ');
}

function escapeCsvValue(value: string) {
  if (/["\n,]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function satisfiesParsedPrimarySourceArtifact(value: ParsedPrimarySourceArtifact) {
  return value;
}

function satisfiesLeadRowArtifact(value: LeadRowArtifact) {
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
