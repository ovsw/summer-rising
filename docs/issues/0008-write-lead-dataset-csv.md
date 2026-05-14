## Parent

#1

## What to build

Write the Lead Dataset to CSV for a Program Year with stable column ordering, source/provenance fields, and values needed for client spreadsheet workflows.

## Acceptance criteria

- [ ] CSV includes site, district, address, city, state, zip, grades, Provider, Provider Contact, Affiliated School, and School Verification fields.
- [ ] CSV includes Program Year, retrieved-at, source URL/source identifier, and public source IDs where available.
- [ ] Missing public values are written consistently and not guessed.
- [ ] Column order is stable and documented.
- [ ] CSV writer tests verify escaping, missing values, and one row per Lead Row.

## Blocked by

- #6.
