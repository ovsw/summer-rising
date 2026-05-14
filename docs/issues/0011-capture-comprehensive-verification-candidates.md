## Parent

#1

## What to build

Replace the current tiny static Verification Source candidate set with comprehensive public verification candidate capture. The extractor should gather public candidate records for the Affiliated School List values that appear in cached Primary Source records, then use those candidates during School Verification.

Today, most rows become `source only` because verification compares the Lead Dataset against only the discovery-time sample autocomplete query. That is not enough to validate the real dataset.

## Acceptance criteria

- [ ] Snapshot or extraction flow gathers Verification Source candidates for the affiliated schools found in the Primary Source snapshots.
- [ ] Candidate capture stays inside the Allowed Source Boundary: public, unauthenticated data only; no login, no private cookies, no guessed values.
- [ ] Candidate capture is cached as Source Snapshots or another auditable raw artifact with Program Year, retrieval time, source URL, and query metadata.
- [ ] Candidate capture is conservative: low concurrency, no repeated live lookups when cached candidates already exist.
- [ ] Candidate extraction handles the known public MySchools autocomplete response shape and any other approved public verification source shape discovered during implementation.
- [ ] School Verification uses the comprehensive candidate set instead of only the static discovery sample.
- [ ] Rows with exact DBN/building-code matches become `verified`.
- [ ] Rows with no public candidate remain `source only` or `missing`, not guessed.
- [ ] Fuzzy matches remain suggestions or review items, not verified matches.
- [ ] A real manual run produces a materially higher verified count than the current sample-only candidate set.
- [ ] Tests cover candidate capture for multiple affiliated schools, cache reuse, exact match verification, no-candidate behavior, and no row dropping.

## Blocked by

- #10.

## Blocks

- #9.
