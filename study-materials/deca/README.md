# DECA Study Outlines — Official 2025–2026 (refined)

Seven exam outlines that cover **every** DECA competitive event. DECA reuses the
same exam across many events, so you only need these seven (not one per event).

## What these are based on (exactly)
- **Instructional areas + item counts:** the official **DECA Exam Blueprints 2025**
  and the **MBA Research DECA Exam Specifications**, at the **ICDC / national**
  level. Every exam's item counts sum to **100** (verified).
- **Objectives:** authentic **MBA Research performance indicators** taken from the
  official DECA Career Cluster Performance Indicator documents (verbatim wording;
  indicator codes removed for readability). Each area lists a representative
  subset of its performance indicators — enough to guide question generation;
  expand from the official PI list anytime.

## The seven exams (folders here)

- `business-administration-core/` — the "Principles" events (first-year members)
- `marketing-cluster/`
- `finance-cluster/`
- `hospitality-tourism-cluster/`
- `business-management-administration-cluster/`
- `entrepreneurship/`
- `personal-financial-literacy/`

## Which event uses which exam (official mapping)

**Business Administration Core** — Principles of Business Management & Administration,
Principles of Finance, Principles of Hospitality & Tourism, Principles of Marketing.

**Business Management & Administration Cluster** — Business Law and Ethics,
Human Resources Management.

**Marketing Cluster** — Apparel & Accessories Marketing, Automotive Services
Marketing, Business Services Marketing, Buying & Merchandising, Food Marketing,
Integrated Marketing Campaign (Event / Product / Service), Marketing
Communications, Marketing Management, Professional Selling, Retail Merchandising,
Sports & Entertainment Marketing.

**Finance Cluster** — Accounting Applications, Business Finance, Financial
Services, Financial Consulting.

**Hospitality & Tourism Cluster** — Hospitality Services, Travel & Tourism,
Hotel & Lodging Management, Quick Serve Restaurant Management, Restaurant & Food
Service Management, Hospitality & Tourism Professional Selling.

**Entrepreneurship Exam** — Entrepreneurship Team Decision Making,
Entrepreneurship Series (and related entrepreneurship events).

**Personal Financial Literacy Exam** — Personal Financial Literacy.

## Format (matches the app parser)

Each `event-outline.txt` uses `A. <Instructional Area> (<N> items)` headers with
numbered performance indicators, identical to the FBLA and HOSA outlines, so they
parse into the sidebar and feed `generate_bank.py` the same way.

## Accuracy notes
- Item counts are ICDC-level; DECA also publishes District and Association
  blueprints with slightly different counts. Re-check the current-year blueprint
  before a season.
- A few Personal Financial Literacy indicators were lightly completed where the
  source PDF truncated them; wording is otherwise verbatim.

Sources: DECA Exam Blueprints 2025 (deca.org) · MBA Research DECA Exam
Specifications · DECA Career Cluster Performance Indicators (deca.org /
mbaresearch.org).

## Next step: question banks

No `question-bank.json` exists yet for these events. Run `generate_bank.py`
per event (event → section → objective tiers) to produce them, same as the
FBLA/HOSA event folders.
