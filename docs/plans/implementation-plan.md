# Summer Rising Data Extractor Implementation Plan

## Parent

- GitHub issue: #1, "PRD: Summer Rising data extractor"
- Context: `CONTEXT.md`
- ADR: `docs/adr/0001-allowed-source-boundary.md`

## Sequence

1. Discover public source endpoints and field availability.
2. Scaffold the extractor CLI, project structure, and fixture-based tests.
3. Capture Source Snapshots with conservative caching.
4. Parse Primary Source records into source-shaped domain records.
5. Normalize records into Lead Rows.
6. Add School Verification against public Verification Sources.
7. Write Lead Dataset CSV output.
8. Produce Validation Report and data dictionary.

## Dependency Shape

- Endpoint discovery is the only unblocked implementation slice.
- Scaffold can start after discovery confirms source shape.
- Snapshot/cache and parser work depend on discovery.
- Lead Row normalization depends on parser output.
- School Verification depends on normalized Affiliated School and Summer Rising Site data.
- CSV output depends on Lead Row normalization.
- Validation Report and data dictionary depend on the output schema and observed source availability.

## Issue Breakdown

- Endpoint discovery: AFK, unblocked.
- Extractor scaffold: AFK, blocked by endpoint discovery.
- Source Snapshot capture/cache: AFK, blocked by endpoint discovery and scaffold.
- Primary Source parser: AFK, blocked by snapshot capture/cache.
- Lead Row normalization: AFK, blocked by parser.
- School Verification: AFK, blocked by Lead Row normalization.
- CSV writer: AFK, blocked by Lead Row normalization.
- Validation Report and data dictionary: AFK, blocked by CSV writer and School Verification.
