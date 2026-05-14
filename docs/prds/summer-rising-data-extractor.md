# Summer Rising Data Extractor PRD

## Problem Statement

The client is gathering lead data for sales calls to sell a camp theater program to Summer Rising providers in New York City. Today, the client manually opens the MySchools Summer Rising map, clicks each Summer Rising site, checks related school information against the NYC Public Schools website, and copies site, provider, director, contact, grade, district, address, and affiliated school details into a spreadsheet.

This manual workflow is slow, repetitive, hard to audit, and likely to break down year to year because Summer Rising locations and providers change annually. The client needs a reproducible way to extract public, unauthenticated Summer Rising lead data, verify school identity where possible, and produce a reviewable sales-ready spreadsheet without bypassing login requirements or inventing missing data.

## Solution

Build a small maintainable extractor that discovers and uses the public data endpoints behind the MySchools Summer Rising web app where possible, falling back to controlled browser automation only for public fields that are visible in the app but unavailable from direct JSON responses.

The extractor will output a CSV as the primary deliverable, preserve raw source snapshots for audit/debug, produce a validation report, and include source/provenance fields so missing or uncertain data is explicit. NYC DOE school verification will be treated as enrichment and QA, not as a reason to drop Summer Rising records.

## User Stories

1. As a sales operator, I want a CSV of Summer Rising sites and providers, so that I can import leads into a spreadsheet or CRM.
2. As a sales operator, I want one row per site and provider, so that each outreach target is independently filterable without multiplying rows by affiliated school count.
3. As a sales operator, I want site names included exactly as displayed by MySchools, so that I can recognize the same records the client sees manually.
4. As a sales operator, I want district values for each site, so that I can group leads by NYC school district.
5. As a sales operator, I want street address, city, state, and zip split into separate columns, so that I can sort, filter, and mail-merge accurately.
6. As a sales operator, I want exact displayed grades preserved, so that edge cases are not hidden by normalization.
7. As a sales operator, I want normalized grade buckets for K-5, 6-8, and 9-12, so that I can filter by the program age ranges the client cares about.
8. As a sales operator, I want provider names preserved exactly as shown, so that I can trace each row back to the source.
9. As a sales operator, I want normalized provider names, so that duplicate or variant provider labels can be grouped.
10. As a sales operator, I want provider websites when publicly available, so that I can research each contractor before outreach.
11. As a sales operator, I want site director names when publicly available, so that outreach can be addressed to a person where appropriate.
12. As a sales operator, I want site director emails when publicly available, so that outreach can be routed correctly.
13. As a sales operator, I want site director phone numbers when publicly available, so that call lists can be built.
14. As a sales operator, I want missing director/contact values marked as missing rather than guessed, so that I do not rely on fabricated contact data.
15. As a sales operator, I want schools affiliated with each Summer Rising site parsed into structured columns, so that I can verify and filter by school.
16. As a sales operator, I want the raw affiliated school display text preserved, so that parsing errors can be audited.
17. As a sales operator, I want affiliated school DBN or school code extracted when exposed, so that records can be matched reliably.
18. As a sales operator, I want Summer Rising program codes extracted when exposed, so that records can be grouped by source identifiers.
19. As a sales operator, I want public MySchools record IDs preserved, so that reruns can dedupe reliably.
20. As a sales operator, I want public DOE identifiers preserved, so that school verification is stable across runs.
21. As a sales operator, I want DOE match status on each row, so that I can separate verified records from records needing review.
22. As a sales operator, I want suggested DOE matches marked separately from verified matches, so that uncertain matches are not treated as facts.
23. As a sales operator, I want review reasons for uncertain rows, so that manual cleanup can be targeted.
24. As a sales operator, I want all MySchools Summer Rising rows included even if DOE verification fails, so that potential leads are not silently dropped.
25. As a sales operator, I want a validation report, so that I know the completeness and quality of the extracted data.
26. As a sales operator, I want duplicate site/provider/school rows flagged, so that I can remove accidental duplicates without losing intentional multiple-provider rows.
27. As a sales operator, I want provider counts per site, so that duplicate-looking site rows are understandable.
28. As a project owner, I want raw source responses saved, so that I can debug parser changes without repeatedly scraping the website.
29. As a project owner, I want outputs named by program year, so that annual Summer Rising datasets do not overwrite each other.
30. As a project owner, I want retrieved timestamps on every row, so that I can prove when the data was collected.
31. As a project owner, I want a data dictionary, so that the client understands field meaning, source, transform, and availability.
32. As a project owner, I want unavailable requested fields documented, so that missing public data is not confused with scraper failure.
33. As a project owner, I want a dry-run endpoint inspection command, so that I can confirm public JSON availability before full extraction.
34. As a developer, I want direct public API extraction attempted before browser scraping, so that the scraper is fast and less brittle.
35. As a developer, I want browser automation available as a fallback for public visible data, so that source fields visible in the UI can still be captured if no endpoint exposes them directly.
36. As a developer, I want field-level source notes where hybrid extraction is used, so that API and browser-derived values are distinguishable.
37. As a developer, I want deterministic DOE matching before fuzzy matching, so that exact identifiers and addresses are trusted first.
38. As a developer, I want fuzzy matching to produce candidates only, so that uncertain matches require human review.
39. As a developer, I want focused parser and matcher tests, so that source-site changes can be diagnosed quickly.
40. As a developer, I want fixtures from saved raw responses, so that tests do not depend on live web availability.
41. As a developer, I want low request concurrency and caching, so that development and reruns avoid unnecessary public-site load.
42. As a developer, I want clear failures for required configuration, so that missing critical inputs do not create silent correctness bugs.
43. As a client stakeholder, I want the extractor to use only public unauthenticated data, so that the process respects access boundaries.
44. As a client stakeholder, I want no login automation or stored credentials, so that private parent/student data is never involved.
45. As a client stakeholder, I want the tool to stop at lead data generation, so that outreach remains inside reviewed CRM/email workflows.

## Implementation Decisions

- Treat MySchools Summer Rising public data as the primary source of truth for which Summer Rising sites exist in the current program year.
- Treat NYC DOE school data as verification/enrichment, not as a filter that can remove MySchools Summer Rising rows.
- Use only public, unauthenticated sources. Do not automate login, reuse private cookies, bypass access controls, or infer private fields.
- Build with Node.js and TypeScript, with Playwright available for endpoint inspection and public UI fallback extraction.
- Prefer public JSON/API extraction over DOM scraping. Use browser network inspection to discover candidate endpoints before building parsers around visible UI.
- Include a dry-run inspection command that captures candidate network requests and summarizes likely endpoints/fields without writing final CSV output.
- Store raw source responses in timestamped snapshots and normalized outputs separately.
- Output CSV first. XLSX or Google Sheets delivery can be added later if the client needs formatting, frozen headers, or direct spreadsheet publishing.
- Model the row grain as one row per Summer Rising site and provider, with affiliated schools retained as supporting context on the row.
- Updated decision: the original site/provider/affiliated-school row grain was superseded after client review; provider contact information is the primary sales target for this time-sensitive project.
- Repeat shared site fields on each provider/school row and include grouping identifiers for dedupe and aggregation.
- Preserve exact source display values and add normalized companion fields where needed.
- Preserve public source IDs such as MySchools site IDs, program IDs, DOE DBNs, and exposed school/program codes whenever available.
- Include `program_year` and `retrieved_at` on every normalized row.
- Include source/provenance fields such as source URL, source system, and field/source notes where hybrid extraction is used.
- Normalize grades into broad K-5, 6-8, and 9-12 buckets while preserving the exact displayed grade range.
- Normalize provider names for grouping while preserving the displayed provider name for auditability.
- Parse affiliated school display text into structured fields where possible, while preserving the original display text.
- Use deterministic DOE matching first: exact exposed school/building code, then normalized address plus borough/zip.
- Use fuzzy matching only to suggest a candidate and mark the row as requiring review.
- Use categorical match confidence values such as `verified`, `source_only`, `suggested_match`, `needs_review`, and `missing`.
- Do not enrich principal or school administrator contacts in the first version.
- Do not enrich provider contact details from broad external web searches in the first version. Limit v1 to MySchools and NYC DOE public data.
- Do not guess provider websites, emails, phone numbers, or director values. Missing public data must remain missing and be documented.
- Include a validation report with total sites, total provider rows, missing address fields, missing provider contact fields, duplicate row candidates, and DOE matches needing review.
- Include a data dictionary describing each output field, source, transform, and known availability.
- Keep the implementation small but maintainable, with deep modules for endpoint discovery, source fetching/cache, normalization, DOE matching, output writing, and validation reporting.
- Request rate must be conservative, cached during development, and low concurrency by default.
- Include a non-legal usage checkpoint in documentation: confirm public access, review source terms/robots expectations, avoid login/private data, keep request rates low, and get client approval for source usage.

## Testing Decisions

- Tests should focus on externally visible behavior: given saved public source fixtures, the extractor should produce expected normalized rows, match statuses, and validation summaries.
- Parser tests should cover representative MySchools site records, multiple providers per site, multiple affiliated schools, missing provider contact fields, unusual grade ranges, and exposed source identifiers.
- Grade normalizer tests should verify exact display preservation plus K-5, 6-8, and 9-12 bucket assignment.
- Provider normalizer tests should verify grouping keys without mutating displayed names.
- Affiliated school parser tests should verify extraction of school name, DBN/code, displayed grade range, and program code when present.
- DOE matcher tests should cover exact ID/code matches, normalized address matches, suggested fuzzy candidates, and no-match cases.
- CSV writer tests should verify one row per site/provider combination, aggregated affiliated school context, and stable column ordering.
- Validation report tests should verify counts for missing fields, duplicates, provider row totals, site totals, and rows needing review.
- Snapshot/cache behavior should be tested enough to confirm reruns can operate from saved fixtures without live network calls.
- Browser fallback should be tested at a high level only if it becomes necessary after endpoint inspection; do not over-test Playwright internals.
- No prior tests exist in this repo yet. Test structure should be established as part of this implementation.

## Out of Scope

- Scraping or using data that requires login, private cookies, stored credentials, or student/parent account access.
- Bypassing MySchools or NYC DOE access controls.
- Guessing missing emails, phone numbers, director names, provider websites, or school identifiers.
- Sending sales emails or making outreach calls from this system.
- Building a manual review UI in the first version.
- Publishing directly to Google Sheets in the first version.
- Generating a formatted XLSX in the first version unless CSV output proves insufficient.
- Broad external enrichment from provider websites, search engines, directories, or third-party data vendors.
- Enriching principal, school administrator, or unrelated school contacts in the first version.
- Third-party geocoding in the first version.
- Numeric match confidence scores.
- Silent row dropping when DOE verification is missing or uncertain.

## Further Notes

- The MySchools Summer Rising page appears to be a JavaScript application; plain HTML fetches do not expose useful records. Endpoint discovery is therefore the first implementation milestone.
- The current screenshots show the client’s manual workflow: MySchools map/list cards as the primary source and NYC Public Schools search as the verification source.
- The extractor should fail loudly for required configuration and only default optional settings whose absence preserves correctness.
- If public endpoints change year to year, saved raw snapshots and focused tests should make parser updates straightforward.
- This PRD is ready for implementation planning and issue breakdown once endpoint discovery confirms the available public fields.
