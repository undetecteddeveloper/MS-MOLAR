// Rating System [service-integration-e2e] Test Skeleton
// Design Doc: docs/design/rating-system-backend-design.md (Test Boundaries — RLS suite
//   R-p..R-u; Phase-0 Verification Spike S1-S4)
// PRD: docs/prd/rating-system-prd.md (v1.1, AC-001..AC-026, Quantitative Metrics 1,2,4,5,6,7)
// Generated: 2026-07-24 | Budget Used: integration 3/3, fixture-e2e 2/3, service-integration-e2e 2/2
//
// Skeleton only — comments describing what the implementer must write. No imports, no
// executable assertions yet. The backend Design Doc already specifies the exact case
// table for these behaviors (R-p..R-u) as an extension of the existing
// SOURCE/supabase/test-rls.ts harness (assert-based script run via
// `cd SOURCE && npx tsx supabase/test-rls.ts`, real local Supabase, service-role setup
// + signed-in anon clients per user — see ensureUser/signInAs in that file). The
// PREFERRED implementation is to append these cases directly into test-rls.ts
// following its existing pattern (mirroring R-i/R-j/R-k at :429-473), so there is a
// single source of RLS truth. This file originally recorded two
// service-integration-e2e-lane candidates selected by ROI for traceability; Test SE1
// (R-p..R-t eligibility gate + upsert) has been ported into test-rls.ts (R-p..R-u, the
// select-own confinement obligation added there as (f)) and removed from here to avoid
// double-asserting the same behavior. Test SE2 remains reserved below for a future task.

// =============================================================================
// Test SE2 [additional slot, ROI > 50] —
//   Community-difficulty aggregate: threshold, bucket, Hardest order, Level filter
//   against the real exams_with_difficulty view (or its RPC fallback)
// =============================================================================
// AC-014, AC-015, AC-016, AC-018 (bucket + mean vs null-below-3; boundary buckets)
// AC-019, AC-020 (Hardest: rated exams ordered avg_overall desc, below-threshold
//   sunk last, deterministic created_at/id tie-break)
// AC-021 (Level filter excludes below-threshold and other-bucket rows)
// AC-022, AC-023 (PRD metrics 5, 6, 7): no denormalized exams write, no trigger,
//   existing below-threshold exams unaffected
// Mirrors backend Design Doc Phase-0 Verification Spike checks S1-S4, turned into a
// persistent regression test (the spike itself is a one-time blocking gate; this test
// keeps proving the same capability on every run once the mechanism is adopted).
// ROI: 72 (BV:9 x Freq:7 + Legal:0 + Defect:9) — above the service-integration-e2e
//   ROI > 50 threshold: this is real Postgres NULL/order/range semantics that a
//   mocked query builder (integration Test 2) cannot prove.
// Behavior: seed a fixture set of published exams with 0, 1, 2, and >=3 ratings,
//   including two exams tied on the same avg_overall (tie-break check) and mean
//   values at the 4.0/7.0/10.0 boundaries -> read exams_with_difficulty (or the RPC
//   fallback) through PostgREST with the same .eq/.order/.gte/.lt chain the backend
//   Design Doc specifies -> then insert one more rating to flip a 2-rating exam to 3
//   and re-read.
// @category: core-functionality
// @lane: service-integration-e2e
// @dependency: full-system — live local Supabase (Postgres view or RPC fallback +
//   PostgREST), no mocks
// @complexity: high
// @real-dependency: exams_with_difficulty view (or its RPC fallback) — the exact
//   capability under test (NULL-below-3 aggregate, nulls-last ordering, range-filter
//   exclusion of NULL rows) is what the backend Design Doc flags as an unverified
//   PostgREST assumption; only a real DB read can prove it
// Primary failure mode: avg_overall is non-null below 3 ratings, or null at/above 3,
//   breaking the "—" placeholder guarantee (AC-015/023); OR PostgREST does not honor
//   nullsFirst:false plus the chained secondary order, so below-threshold exams do not
//   sink deterministically last (AC-019/020 — the exact risk the phase-0 spike gates);
//   OR the Level filter's gte/lt range admits a NULL (below-threshold) row (AC-021);
//   OR any write lands on the exams table, or a trigger is found to fire (AC-022).
// Proof obligation:
//   (a) rating_count and avg_overall are exactly null for every seeded exam with <3
//       ratings, and a correct { bucket, mean } for every exam with >=3 ratings,
//       including boundary fixtures 3.9/4.0, 6.9/7.0, 1.0, 10.0 bucketed per
//       [1,4)/[4,7)/[7,10] (AC-014/018);
//   (b) a single flat select using the Hardest order chain returns rated exams first
//       (descending avg_overall), all below-threshold rows after them, and a repeated
//       read of the same data yields an identical order — including a stable
//       tie-break by created_at then id for the two tied-mean exams and the two
//       below-threshold exams (AC-019/020, metric 6);
//   (c) a Level=Hard query returns only >=3-rating Hard-bucket rows, excluding
//       below-threshold and other-bucket exams (AC-021);
//   (d) after inserting a 3rd rating for a previously-2-rating exam, the very next
//       read reflects the flip from null to a { bucket, mean }, with no write observed
//       on the exams table and no trigger firing (schema/log inspection, AC-022,
//       metric 7).
