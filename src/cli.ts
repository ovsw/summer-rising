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

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
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

  const sources = manifest.sources.map((source) => {
    const rawPath = path.join(outputRoot, source.raw_path);
    const rawSnapshot = JSON.parse(fs.readFileSync(rawPath, 'utf8')) as {
      response_body: unknown;
    };

    return {
      name: source.name,
      raw_path: source.raw_path,
      response_body: rawSnapshot.response_body,
      source_identifier: source.source_identifier,
      source_kind: source.source_kind,
      url: source.url,
    };
  });

  const normalizedDirectory = path.join(outputRoot, 'normalized', programYear);
  ensureDirectory(normalizedDirectory);

  const normalizedPath = path.join(normalizedDirectory, 'source-snapshots.json');
  fs.writeFileSync(
    normalizedPath,
    JSON.stringify(
      {
        fixture_path: path.relative(outputRoot, fixturePath),
        program_year: manifest.program_year,
        retrieved_at: manifest.retrieved_at,
        sources,
      },
      null,
      2,
    ),
  );

  console.log(`Reused ${sources.length} cached Source Snapshots for program year ${programYear}.`);
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
