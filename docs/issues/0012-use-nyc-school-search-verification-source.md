## Parent

#1

## What to build

Update School Verification so it uses the same public validator source as `https://schoolsearch.schools.nyc/` rather than relying only on the current MySchools District 75 autocomplete endpoint.

The current verifier can miss schools that are plainly searchable in NYC Public Schools Find a School, such as `J.H.S. 210 ELIZABETH BLACKWELL`, because candidate capture is based on a narrow MySchools process autocomplete source. The result is too many `source only` rows in the Lead Dataset.

## Acceptance criteria

- [ ] Discover the public unauthenticated network endpoint(s) used by `https://schoolsearch.schools.nyc/` for school name/address search.
- [ ] Document the endpoint request shape, response shape, and source fields used for verification.
- [ ] Candidate capture uses the NYC School Search public source for Affiliated School List values.
- [ ] Candidate capture remains inside the Allowed Source Boundary: no login, no private cookies, no guessed values.
- [ ] Candidate capture is cached with Program Year, retrieval time, source URL, query metadata, and raw response data.
- [ ] `J.H.S. 210 ELIZABETH BLACKWELL` is covered by a regression test and no longer remains `source only` when the public source returns an exact candidate.
- [ ] Existing exact ID/code, normalized address plus borough/zip, fuzzy suggestion, and no-candidate behaviors still work.
- [ ] A real manual run materially reduces `source only` rows compared with the current MySchools District 75 autocomplete-only verifier.
- [ ] Tests cover public source parsing, exact-match verification from NYC School Search candidates, cache reuse, and no Lead Row dropping.

## Blocked by

- #11.

## Blocks

- #9.
