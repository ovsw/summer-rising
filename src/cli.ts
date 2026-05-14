import fs from 'node:fs';
import path from 'node:path';

const repoRoot = '/Users/ovs/Work/summer-rising';
const supportedCommands = ['inspect', 'snapshot', 'extract', 'validate'] as const;
type SupportedCommand = (typeof supportedCommands)[number];

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

function requireProgramYear() {
  const programYear = process.env.SUMMER_RISING_PROGRAM_YEAR;
  if (!programYear) {
    throw new Error('Missing required env var SUMMER_RISING_PROGRAM_YEAR.');
  }

  return programYear;
}

function runInspect(fixturePath: string) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
    primary_sources?: unknown[];
    verification_sources?: unknown[];
  };

  printUsage();
  console.log(`Fixture: ${path.relative(repoRoot, fixturePath)}`);
  console.log(`Primary Sources: ${fixture.primary_sources?.length ?? 0}`);
  console.log(`Verification Sources: ${fixture.verification_sources?.length ?? 0}`);
  console.log('Source Snapshot workflow ready.');
}

function runSnapshot(fixturePath: string) {
  console.log(`Snapshot command ready for fixture ${path.relative(repoRoot, fixturePath)}.`);
}

function runExtract(fixturePath: string) {
  const programYear = requireProgramYear();
  console.log(
    `Extract command ready for program year ${programYear} with fixture ${path.relative(repoRoot, fixturePath)}.`,
  );
}

function runValidate(fixturePath: string) {
  const programYear = requireProgramYear();
  console.log(
    `Validate command ready for program year ${programYear} with fixture ${path.relative(repoRoot, fixturePath)}.`,
  );
}

function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const fixturePath = resolveFixturePath(options.get('fixture'));

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
      runSnapshot(fixturePath);
      break;
    case 'extract':
      runExtract(fixturePath);
      break;
    case 'validate':
      runValidate(fixturePath);
      break;
  }
}

main();
