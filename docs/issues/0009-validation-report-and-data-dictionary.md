## Parent

#1

## What to build

Produce a Validation Report and data dictionary for each Lead Dataset. The report should summarize completeness and review needs. The data dictionary should define each output field, source, transform, and availability.

## Acceptance criteria

- [ ] Validation Report includes total Summer Rising Sites, total Lead Rows, Provider row counts, missing address fields, missing contact fields, duplicate row candidates, and verification rows needing review.
- [ ] Data dictionary lists every CSV column with definition, source, transform, and availability status.
- [ ] Requested fields unavailable from allowed public sources are documented as missing rather than omitted.
- [ ] Report can be regenerated from Source Snapshots and normalized outputs.
- [ ] Tests verify report counts and data dictionary coverage for the produced schema.

## Blocked by

- #7.
- #8.
- #10.
- Comprehensive Verification Source candidate capture.
- NYC School Search Verification Source alignment.
