## Parent

#1

## What to build

Inspect the public MySchools Summer Rising web app and NYC Public Schools lookup flow to identify public, unauthenticated endpoints and fields available inside the Allowed Source Boundary. Capture at least one representative Source Snapshot and produce a field availability matrix for the requested Lead Dataset fields.

## Acceptance criteria

- [x] Public MySchools Summer Rising network calls are inspected without login or private cookies.
- [x] Candidate Primary Source endpoints are documented with request shape, response shape summary, and field coverage.
- [x] Candidate Verification Source endpoints or lookup surfaces are documented with request shape, response shape summary, and field coverage.
- [x] At least one Source Snapshot is captured from public data.
- [x] A field availability matrix maps requested fields to Primary Source, Verification Source, External Enrichment, or missing.
- [x] The ticket states whether browser fallback is needed for any public visible field.
- [x] No login-gated, guessed, or private data is used.

## Outcome

- Discovery artifact: [public-source-endpoints.json](/Users/ovs/Work/summer-rising/artifacts/discovery/public-source-endpoints.json)
- Representative primary snapshot: [2026-05-14-myschools-summer-rising-site-sample.json](/Users/ovs/Work/summer-rising/artifacts/discovery/snapshots/2026-05-14-myschools-summer-rising-site-sample.json)
- Representative verification snapshot: [2026-05-14-myschools-d75-autocomplete-sid-miller.json](/Users/ovs/Work/summer-rising/artifacts/discovery/snapshots/2026-05-14-myschools-d75-autocomplete-sid-miller.json)

## Findings

Public MySchools JSON exposes the core Summer Rising lead fields without login.

Confirmed public primary endpoints:

1. `https://www.myschools.nyc/en/api/v2/admissionprocesses`
   Identifies the active Summer Rising admissions process. On May 14, 2026, Summer Rising is process `45` and points to `http://www.myschools.nyc/en/api/v2/schools/process/45/`.
2. `https://www.myschools.nyc/en/api/v2/schools/process/45/?page=1`
   Returns paginated Summer Rising site JSON. Observed fields include site name, site DBN, district, borough, address, building code, grade range, affiliated school names, nested program names, program codes, portfolio IDs, provider contact fields, and site contact fields.
3. `https://www.myschools.nyc/en/api/v2/filters/process/45/`
   Returns public filter metadata used by the live Summer Rising UI, including borough and seat-availability filters.

Confirmed public verification lookup surfaces:

1. `https://www.myschools.nyc/en/api/v2/schools/process/{process_id}/autocomplete/?q=<school name>`
   Public autocomplete JSON for directory processes. The strongest confirmed verification example is District 75 process `46`, which returns DBN candidates for `Sid Miller Academy`.
2. `https://www.schools.nyc.gov/enrollment/enroll-grade-by-grade/3k/enrollment---find-a-school-public-school`
   Public NYC Public Schools lookup surface. In the inspected flow, it routes users to MySchools for the actual directory search. No separate unauthenticated structured JSON endpoint was confirmed from `schools.nyc.gov` in this slice.

## Field Availability

Core lead fields map as follows:

- Primary Source: Summer Rising site, site DBN, provider name, site contact name, site contact email, site contact phone number, provider website/email/phone fields, grade range, district, borough, site address, building code, affiliated school name, program code, portfolio ID.
- Verification Source: affiliated school DBN candidate via public school-directory autocomplete.
- Missing: principal or school administrator contact. This remains intentionally out of scope for v1 per the PRD.

## Browser Fallback

Browser fallback is not needed for the core lead fields discovered in this issue. Public JSON already exposes the required site, provider, contact, grade, district, address, and affiliated-school-name fields.

Keep Playwright/browser inspection available for later slices when:

- an affiliated school name needs manual disambiguation across multiple public directory matches, or
- a future field is visible on a public page but not confirmed in JSON.

## Blocked by

- None.
