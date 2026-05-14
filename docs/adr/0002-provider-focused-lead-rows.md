# Provider-Focused Lead Rows

Status: accepted

## Context

The original Lead Row grain was one row per Summer Rising Site, Provider, and Affiliated School combination. That made school-level filtering easy, but it multiplied rows heavily when one site/provider relationship listed several affiliated schools.

After a real manual run, the Lead Dataset produced 2,357 rows from 386 source site records. The client clarified that, for the current time-sensitive sales project, cataloging every affiliated school is less important than obtaining the Provider Contact or provider-level contact channel attached to each provider.

## Decision

Lead Rows are provider-focused: one Lead Row represents one Provider's offering at one Summer Rising Site. Affiliated Schools are retained as supporting context on the Lead Row rather than multiplying the row grain.

School Verification is summarized at the Lead Row level. When affiliated school verification outcomes differ, the row uses the highest-action Verification Status rather than the happiest status.

## Considered Options

- One row per Summer Rising Site, Provider, and Affiliated School combination.
- One row per Summer Rising Site and Provider, with affiliated schools listed together.

## Consequences

- The Lead Dataset is more compact and better aligned to provider-focused sales outreach.
- Affiliated school detail remains available, but not as the primary row grain.
- CSV output and validation reporting must aggregate affiliated school names, DBNs, and verification outcomes.
- Closed issues that implemented the old row grain remain historical; a new follow-up issue should implement this requirement change.
