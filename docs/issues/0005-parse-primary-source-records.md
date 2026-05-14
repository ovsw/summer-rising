## Parent

#1

## What to build

Parse MySchools Primary Source snapshots into source-shaped records for Summer Rising Sites, Providers, Affiliated Schools, Provider Contacts, Display Values, and public source identifiers.

## Acceptance criteria

- [ ] Parser reads Source Snapshots rather than live endpoints directly.
- [ ] Parser preserves Display Values exactly as exposed by the Primary Source.
- [ ] Parser extracts Summer Rising Site fields, Provider fields, Affiliated School fields, Provider Contact fields, and public IDs when available.
- [ ] Parser represents missing public values explicitly.
- [ ] Parser tests cover multiple Providers, multiple Affiliated Schools, missing contact fields, and unusual grade ranges.
- [ ] Parser does not perform Verification Source matching or CSV writing.

## Blocked by

- #4.
