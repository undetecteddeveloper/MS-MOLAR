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
// single source of RLS truth. This file exists to record the two
// service-integration-e2e-lane candidates selected by ROI for traceability; if the
// implementer appends to test-rls.ts instead, delete this file rather than
// double-asserting the same behavior.

// =============================================================================
// Test SE1 [RESERVED SLOT — real-DB write correctness the reserved fixture-e2e
//   journey (FE1) cannot verify with mocks] —
//   Eligibility gate + upsert against real Supabase RLS
// =============================================================================
// AC-008 (PRD metric 1): "...the write is rejected at the server/database layer and
//   no rating row is created or updated."
// AC-009: "...eligibility is satisfied and the rating persists."
// AC-012 (PRD metric 2): "...their existing rating row is updated in place (no second
//   row is created) and the new three scores replace the old ones."
// PRD Security: "...only on published exams..."
// Mirrors backend Design Doc RLS cases R-p, R-q, R-r, R-s, R-t.
// ROI: 90 (BV:10 x Freq:8 + Legal:0 + Defect:10) — reserved regardless of score: this
//   is the security-critical DB-layer guarantee (PRD metric 1 requires 100%) that no
//   mock can validate (Test Boundaries: "Supabase DB + RLS + view — Mock? No — RLS...
//   cannot be validated by mocks").
// Behavior: against a real local Supabase project, seed a published exam with a
//   submitted exam_attempts row for user A, a published exam with NO submitted
//   attempt for user A, and a non-published exam with a submitted attempt for user A
//   -> attempt rating writes as each user/exam combination.
// @category: core-functionality
// @lane: service-integration-e2e
// @dependency: full-system — live local Supabase (Postgres + RLS), exam_difficulty_ratings
//   table + ratings_insert_own / ratings_update_own / ratings_select_own policies
// @complexity: high
// @real-dependency: Supabase Postgres + RLS — this is the sanctioned real-dependency
//   boundary; per backend Design Doc Test Boundaries, RLS/CHECK/unique-constraint
//   enforcement "cannot be validated by mocks" (no mock is used anywhere in this test)
// Primary failure mode: a missed AND-clause in the insert/update RLS with-check
//   (user_id = auth.uid() AND published EXISTS AND submitted-attempt EXISTS) lets an
//   ineligible or non-published-exam write persist a row, defeating PRD metric 1; OR
//   the update-own policy is missing/misconfigured so a re-rate INSERTs a second row
//   instead of upserting in place, defeating PRD metric 2; OR the unique(exam_id,
//   user_id) constraint is absent so a raw duplicate INSERT succeeds.
// Proof obligation — assert row counts/content read directly from the database after
//   each attempt (not from the client's return value alone):
//   (a) an eligible user's insert succeeds: exactly 1 row exists for (examId, userId)
//       with the submitted scores (AC-009; R-p);
//   (b) a user with no submitted attempt on the exam: the insert is rejected by RLS
//       and 0 rows exist for that (examId, userId) (AC-008, metric 1; R-q);
//   (c) the same eligible user submits new scores a second time: exactly 1 row exists
//       for (examId, userId), and its scores equal only the latest submission, never
//       the first (AC-012, metric 2; R-r);
//   (d) an otherwise-eligible user attempts a write against a non-published exam: the
//       write is rejected (PRD Security; R-s);
//   (e) a raw duplicate INSERT (not upsert) for the same (exam_id, user_id) fails with
//       a unique-constraint violation (metric 2 uniqueness; R-t).

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
