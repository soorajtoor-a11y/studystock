# DECA Study Outlines — Official 2025–2026 (refined)

Seven exam outlines covering **every** DECA competitive event. DECA reuses one exam across
many events, so these seven cover the whole program.

## What these are based on (exactly)
- **Instructional areas + item counts:** the official **DECA Exam Blueprints 2025** and the
  **MBA Research DECA Exam Specifications**, at the **ICDC / national** level. Every exam's
  item counts sum to **100** (verified).
- **Objectives:** authentic **MBA Research performance indicators** taken from the official
  DECA Career Cluster Performance Indicator documents (verbatim wording; indicator codes
  removed for readability). Each area lists a representative subset of its performance
  indicators — enough to guide question generation; expand from the official PI list anytime.

## The seven exams
- `business-administration-core/` — Principles events (first-year members)
- `business-management-administration-cluster/`
- `finance-cluster/`
- `marketing-cluster/`
- `hospitality-tourism-cluster/`
- `entrepreneurship/`
- `personal-financial-literacy/`

## Format (matches the app parser)
Each `event-outline.txt` uses `A. <Instructional Area> (<N> items)` headers with numbered
performance indicators, identical to the FBLA outlines, so they parse and feed
`generate_bank.py` the same way.

## Accuracy notes
- Item counts are ICDC-level; DECA also publishes District and Association blueprints with
  slightly different counts. Re-check the current-year blueprint before a season.
- A few Personal Financial Literacy indicators were lightly completed where the source PDF
  truncated them; wording is otherwise verbatim.

Sources: DECA Exam Blueprints 2025 (deca.org) · MBA Research DECA Exam Specifications ·
DECA Career Cluster Performance Indicators (deca.org / mbaresearch.org).
