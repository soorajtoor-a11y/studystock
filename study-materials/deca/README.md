# DECA Study Outlines

Seven exam outlines that cover **every** DECA competitive event. DECA reuses the
same exam across many events, so you only need these seven (not one per event).

Source: MBA Research **DECA Exam Specifications 2024–2025** (the official
blueprint). Item counts use the **national / ICDC** column and sum to 100 per
exam. Objectives are representative **performance indicators** per instructional
area — enough to guide question generation; expand anytime.

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

## Format note (matches the app parser)

Each `event-outline.txt` uses the same structure as the FBLA outlines:
a `KNOWLEDGE AREAS AND OBJECTIVES` block with headers `A. <Instructional Area>
(<N> items)` and numbered objectives `1. …`. So they parse into the sidebar and
feed `generate_bank.py` exactly like FBLA events.

## To make these live in the app

These live under `study-materials/deca/…` so they don't clutter the current flat
FBLA event list. To activate them you either:
1. add the small **organization-grouping** layer we discussed (group the sidebar
   by FBLA / DECA / HOSA), or
2. temporarily move/copy each exam folder up to `study-materials/` as its own
   top-level event (optionally prefixed, e.g., `deca-marketing-cluster`).

Then run `generate_bank.py` on each to produce `question-bank.json`.

## Accuracy caveat

DECA publishes new exams yearly and item counts shift slightly by level
(District / Association / ICDC). Before a season, check the current MBA Research
DECA Exam Specifications and adjust the `(N items)` counts if needed.
