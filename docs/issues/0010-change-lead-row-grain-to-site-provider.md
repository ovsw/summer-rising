## Parent

#1

## What to build

Change Lead Row generation so the Lead Dataset is provider-focused: one Lead Row per Summer Rising Site and Provider, with Affiliated Schools retained as supporting context instead of multiplying rows.

## Acceptance criteria

- [ ] `lead-rows.json` emits one Lead Row per Summer Rising Site and Provider.
- [ ] `lead-dataset.csv` emits one CSV row per Summer Rising Site and Provider.
- [ ] Affiliated School names are preserved as a list or delimited field on each Lead Row.
- [ ] Affiliated School DBNs are preserved as a list or delimited field on each Lead Row when publicly available.
- [ ] Provider Contact and provider-level contact fields remain first-class fields.
- [ ] School Verification is summarized at the Lead Row level using the highest-action Verification Status when affiliated school outcomes differ.
- [ ] The existing fixture case with two Providers and two Affiliated Schools produces two Lead Rows, not four.
- [ ] A real manual run no longer multiplies rows by Affiliated School count.
- [ ] Tests cover row grain, aggregated affiliated schools, row-level School Verification summary, and unchanged provider contact fields.

## Blocked by

- #8.

## Blocks

- #9.
