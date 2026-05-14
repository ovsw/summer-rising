# Allowed Source Boundary for Lead Data

Status: accepted

## Context

The Summer Rising lead dataset is intended for sales research. The tempting path is to maximize contact coverage by combining MySchools, NYC Public Schools, provider websites, search results, guessed email patterns, and any data visible after login.

That approach would make the dataset harder to audit and could cross access or privacy boundaries. The first version needs trustworthy provenance more than maximum contact coverage.

## Decision

Lead data will stay inside the Allowed Source Boundary: only public, unauthenticated source data may be used, and guessed, private, or login-gated values are excluded.

MySchools Summer Rising is the Primary Source for inclusion in the lead dataset. Public NYC DOE/Public Schools data may be used as a Verification Source. External Enrichment is out of scope for the first version unless it is explicitly approved later and remains inside the Allowed Source Boundary.

## Considered Options

- Use only public MySchools and NYC DOE/Public Schools data.
- Also enrich from provider websites and public directories.
- Also infer likely contact details from naming patterns or login-gated pages.

## Consequences

- Some requested contact fields may be missing.
- Missing public values must be represented as missing rather than guessed.
- Every Lead Row remains easier to trace back to allowed public sources.
- Future External Enrichment must be explicitly approved instead of quietly added.
