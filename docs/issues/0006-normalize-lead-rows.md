## Parent

#1

## What to build

Convert parsed Primary Source records into Lead Rows at the agreed row grain: one Summer Rising Site, one Provider, and one Affiliated School combination when all are publicly available. Preserve Display Values and add normalized companion values.

## Acceptance criteria

- [ ] Lead Rows repeat shared site fields intentionally for each Provider/Affiliated School combination.
- [ ] Provider names have both Display Value and normalized grouping value.
- [ ] Grade values have both Display Value and K-5, 6-8, and 9-12 bucket indicators.
- [ ] Public source IDs are preserved where available.
- [ ] Program Year and retrieved-at values are present on each Lead Row.
- [ ] Tests verify row grain, duplicate-looking intentional rows, grade buckets, and provider normalization.

## Blocked by

- #5.
