## Parent

#1

## What to build

Implement Source Snapshot capture and caching for public Primary Source and Verification Source responses. Snapshots must be timestamped, tied to one Program Year, and reusable by tests and offline parsing.

## Acceptance criteria

- [ ] Snapshot capture stores public source responses with Program Year and retrieval time metadata.
- [ ] Snapshot paths separate raw source data from normalized outputs.
- [ ] Re-running extraction can use existing snapshots without refetching.
- [ ] Request rate is conservative and low concurrency by default.
- [ ] Snapshot fixtures can be loaded by tests without live network calls.
- [ ] Snapshot metadata records source URL or source identifier where available.

## Blocked by

- #2.
- #3.
