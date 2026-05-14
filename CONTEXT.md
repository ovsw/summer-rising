# Summer Rising Lead Data

## Language

- **Summer Rising Site** — A public MySchools listing for a place where Summer Rising programming is offered for a given program year.
- **Provider** — An organization publicly associated with a Summer Rising Site that may operate or coordinate programming at that site.
- **Affiliated School** — A school publicly named in connection with a Provider's Summer Rising offering at a Summer Rising Site.
- **Affiliated School List** — The supporting list of Affiliated Schools associated with a Lead Row.
- **Lead Row** — One sales-facing record for a Provider's offering at a Summer Rising Site, with any Affiliated Schools listed as supporting context.
- **Primary Source** — The public MySchools Summer Rising listing used to decide which Summer Rising Sites exist for a program year.
- **Verification Source** — A public source used to confirm or qualify school identity details without deciding whether a Summer Rising Site belongs in the dataset.
- **School Verification** — The row-level summary of comparing a Lead Row's Affiliated School List or Summer Rising Site against a Verification Source.
- **Verification Status** — The categorical confidence assigned to a School Verification; allowed statuses are **verified**, **source only**, **suggested match**, **needs review**, and **missing**, where row-level summaries use the highest-action status in this order: **needs review**, **suggested match**, **verified**, **source only**, **missing**.
- **Allowed Source Boundary** — The rule that Lead Rows may use only public, unauthenticated source data and must not use guessed, private, or login-gated values.
- **Source Snapshot** — A saved copy of public source data captured for a specific program year and retrieval time.
- **Program Year** — The Summer Rising season whose public listings are being captured.
- **Provider Contact** — A public contact person or contact channel associated with a Provider's offering at a Summer Rising Site.
- **External Enrichment** — Adding lead information from public sources outside the Primary Source and Verification Sources.
- **Lead Dataset** — The collection of Lead Rows produced for a Program Year.
- **Validation Report** — A summary of completeness and review issues found in a Lead Dataset.
- **Display Value** — The exact public source text retained for auditability before any normalization.
- **Outreach Target** — The Provider Contact or provider-level contact channel used for sales follow-up from a Lead Row.

## Relationships

- A **Summer Rising Site** may have one or more **Providers**.
- A **Provider** may be associated with many **Summer Rising Sites**.
- A **Provider** at a **Summer Rising Site** may reference one or more **Affiliated Schools**.
- An **Affiliated School** may appear in connection with more than one **Summer Rising Site** or **Provider**.
- A **Lead Row** belongs to exactly one **Summer Rising Site** and one **Provider** when both are publicly available.
- A **Lead Row** may have an **Affiliated School List** as supporting context.
- An **Affiliated School List** contains zero or more **Affiliated Schools**.
- The **Primary Source** determines whether a **Summer Rising Site** is included in the lead dataset.
- A **Verification Source** can qualify a **Lead Row**, but does not remove it from the lead dataset.
- A **School Verification** belongs to a **Lead Row** when public school identity context can be compared.
- A **School Verification** has exactly one **Verification Status**.
- The **Allowed Source Boundary** applies to every **Lead Row**, **Provider**, **Affiliated School**, and **School Verification** value.
- A **Source Snapshot** can produce many **Lead Rows**.
- A **Source Snapshot** belongs to exactly one **Program Year**.
- A **Summer Rising Site** exists within a **Program Year**.
- A **Provider Contact** belongs to a **Provider** at a **Summer Rising Site** when public source data exposes that relationship.
- **External Enrichment** can add information to a **Lead Row** only when it stays inside the **Allowed Source Boundary**.
- A **Lead Dataset** contains many **Lead Rows**.
- A **Lead Dataset** belongs to exactly one **Program Year**.
- A **Validation Report** describes one **Lead Dataset**.
- A **Lead Row** can include both a **Display Value** and a normalized companion value for the same source fact.
- A **Lead Row** is organized around one **Outreach Target** when public source data exposes contact information.

## Example dialogue

Developer: "Is this row for a school or a Summer Rising Site?"

Domain expert: "It is for a Summer Rising Site; the site may have one or more affiliated schools."

Developer: "Does the affiliated school run the program?"

Domain expert: "Not necessarily; it is the school named in the public Summer Rising listing, while the Provider is the organization associated with the offering."

Developer: "Why do two rows have the same site name?"

Domain expert: "They are separate Lead Rows only when the same Summer Rising Site has multiple Providers."

Developer: "Should a Summer Rising Site disappear if the DOE search cannot verify it?"

Domain expert: "No. The Primary Source decides inclusion; DOE verification only describes confidence in school identity."

Developer: "Is this DOE lookup a new lead?"

Domain expert: "No. It is a School Verification for an existing Lead Row."

Developer: "Should each affiliated school create a separate CSV row for verification?"

Domain expert: "No. School Verification is summarized on the provider-focused Lead Row."

Developer: "What is the sales target if a row names multiple affiliated schools?"

Domain expert: "The Outreach Target is still the Provider Contact or provider-level contact channel, not each affiliated school."

Developer: "Can we fill in a missing director email from a guess?"

Domain expert: "No. The Allowed Source Boundary excludes guessed and login-gated values."

Developer: "Why keep the old source data after the CSV is produced?"

Domain expert: "The Source Snapshot explains what public data was available when the Lead Rows were created."

Developer: "Is the spreadsheet the source of truth?"

Domain expert: "No. The Lead Dataset is the sales-facing output derived from Source Snapshots."

## Flagged ambiguities

- "camp", "location", and "site" were used for the same concept — resolved: use **Summer Rising Site**.
- "contractor" was used to describe provider organizations — resolved: use **Provider** unless a source explicitly establishes contractor status.
- "source only" can look like a failure — resolved: **source only** means the **Lead Row** appears in the **Primary Source**, but no **Verification Source** comparison has confirmed or suggested a school identity.
- "missing" can look like a bad record — resolved: **missing** means a requested value was not publicly available from the allowed sources.
- "Site Director" can imply a single director for the whole site — resolved: use **Provider Contact** unless the source clearly identifies a contact as directing the entire **Summer Rising Site**.
- "normalized" means adding a cleaned companion value while preserving the **Display Value**.
- "Summer Rising Program" is too broad for the current glossary — resolved: use **Program Year**, **Summer Rising Site**, **Provider**, or a future source-specific term instead.
- "Lead Row" previously meant one Summer Rising Site, Provider, and Affiliated School combination — resolved: use one **Lead Row** per **Summer Rising Site** and **Provider**, with **Affiliated Schools** listed as supporting context.
- Multiple affiliated schools can produce mixed verification outcomes — resolved: summarize the **School Verification** on the **Lead Row** using the highest-action **Verification Status**, not the happiest status.
- Closed implementation issues record the requirement that was true when they shipped — resolved: create follow-up issues for requirement changes instead of reopening completed historical work.
