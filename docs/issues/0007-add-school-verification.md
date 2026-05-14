## Parent

#1

## What to build

Add School Verification using public Verification Source data. Deterministic matches should be attempted first, followed by suggested fuzzy candidates only when needed. Verification Status must never remove a Lead Row from the Lead Dataset.

## Acceptance criteria

- [ ] Verification Source data is read from Source Snapshots or approved public fetches inside the Allowed Source Boundary.
- [ ] Exact public ID/code matching is attempted before address matching.
- [ ] Normalized address plus borough/zip matching is deterministic when source data supports it.
- [ ] Fuzzy matching only produces suggested matches and needs-review status.
- [ ] Every School Verification has one Verification Status.
- [ ] Lead Rows remain included when verification is missing, source only, suggested, or needs review.
- [ ] Tests cover verified, source only, suggested match, needs review, and missing cases.

## Blocked by

- #6.
