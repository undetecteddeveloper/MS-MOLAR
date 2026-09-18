// exam_hot_counts() — Kho đề theo kệ [service-integration-e2e] Test Skeleton
// Design Doc: docs/design/exam-shelves-backend-design.md (v1.2, § The SQL objects
//               :210-296, § Test Boundaries and Placement :609-633 "test-rls.ts
//               Phần 10 — what proves the aggregate leaks no identities", row for
//               this exact file at :620)
// ADR:        docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md
//               (D1 aggregate shape + security argument, D6 what the DDL leaves
//               alone)
// PRD:        docs/prd/exam-shelves-prd.md (v1.2, AC-018, AC-025, AC-027, AC-028)
// Generated:  2026-09-18 | Budget used: service-integration-e2e 1/2 (1 reserved
//               slot; 2nd slot intentionally left unfilled — the backend DD names
//               no second service-e2e file for this feature, and no further
//               candidate here needs a live Postgres to be provable)
//
// =============================================================================
// FILE STATUS — read before editing
// =============================================================================
// THE SINGLE CANDIDATE BELOW IS A SKELETON (`it.todo`, one per proof obligation).
// `public.exam_hot_counts()` DOES NOT EXIST ON DEV YET — it is created by the
// backend DD's Migration Procedure (schema.sql §20c), and this whole lane is
// GATED on that migration having been applied: `vitest.localdb.config.ts`'s own
// header states the precondition in capital letters — "Cổng schema B (npm run
// verify:schema) PHẢI XANH TRÊN DEV trước khi chạy config này". This file imports
// NOTHING from a not-yet-existing fixtures module (no `examHotCountsFixtures.ts`
// import here, and no `HAS_LIVE_DB` import either — see the two notes below), so
// it stays green under `tsc --noEmit`/`eslint`/`build` and under a normal
// (non-`test:localdb`) CI run from the moment it is committed, exactly like its
// siblings in this directory before their own fixtures existed.
//
// HOW THIS LANE RUNS: `npm run test:localdb` (from `SOURCE/`), i.e.
// `vitest run --config vitest.localdb.config.ts`, which globs the WHOLE directory
// `tests/e2e/service/**/*.test.{ts,tsx}` with NO exclude list — every file here is
// collected unconditionally the moment it is committed. A collected file with zero
// test tasks makes vitest report "No test suite found in file" and exit 1 (the
// same measured failure mode documented in `vitest.fixture.config.ts`'s header,
// and equally true of this config), so the candidate below carries real
// `it.todo(...)` calls, never bare comments. This lane is MANUAL / opt-in — it is
// deliberately NOT part of `npm test` or the default CI gate (`vitest.localdb.
// config.ts`'s own header: "CHẠY TAY tại máy dev — cố ý tách khỏi npm test").
//
// `HAS_LIVE_DB` NOTE (do not invent an env var here): the repo's precedent
// (`essayGradeWriteFixtures.ts:20-40`, re-exported by `examSearchFixtures.ts`) is
// a COMPUTED boolean — true only when `NEXT_PUBLIC_SUPABASE_URL`,
// `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are all present
// after loading `.env.local` by hand (vitest does not load it). There is no bare
// `process.env.HAS_LIVE_DB`. The `describe` below is deliberately UNGATED in this
// skeleton (every child is `it.todo`, which never executes regardless of skip
// state); the implementing task must wrap it as
// `describe.skipIf(!HAS_LIVE_DB)(...)`, importing `HAS_LIVE_DB` from the new
// `examHotCountsFixtures.ts` module (see next note) once that module exists —
// exactly the shape `exam-search.service.e2e.test.ts:31` already uses.
//
// FIXTURES MODULE — NOT CREATED BY THIS GENERATION ROUND. Backend DD names
// `SOURCE/tests/e2e/service/examHotCountsFixtures.ts` as a companion file the
// implementer must create, following the EXACT shape of the existing precedent
// `SOURCE/tests/e2e/service/examSearchFixtures.ts` (which itself re-exports
// `HAS_LIVE_DB`/`adminClient`/`anonClient` from `essayGradeWriteFixtures.ts`):
//   - `HAS_LIVE_DB: boolean` — re-exported, do not redefine;
//   - a `SLOT` string prefix convention isolating every row this file seeds
//     (exam ids, user emails) so a prefix-scoped teardown never touches real data;
//   - `setUp(admin, slot)` seeding TWO real users (A and B, via
//     `admin.auth.admin.createUser` + `signInWithPassword`, same as
//     `examSearchFixtures.ts:37-65`) plus published/unpublished/banned-author exam
//     rows and `exam_attempts` rows with controlled `status` and `submitted_at`
//     values straddling the hour-snapped window boundaries (see obligation (d)
//     below) — returning both users' authenticated `SupabaseClient`s;
//   - `tearDown(admin, fixture, slot)` — idempotent, prefix-scoped, callable even
//     after a setup failure (same shape as `examSearchFixtures.ts:68-79`);
//   - `serviceClient()` / `anonClient()` for the `service_role` and anonymous
//     grant-boundary probes.
// This test file's `it.todo` names below describe exactly what that module's
// fixtures must make possible; the implementer wires both files in the same
// commit that adds the migration's dev-apply step (backend DD Implementation Plan
// step 8).
//
// -----------------------------------------------------------------------------
// MOCK BOUNDARY — the opposite of every other lane in this generation round
// -----------------------------------------------------------------------------
// NOTHING IS MOCKED. Backend DD Test Boundaries states this as a hard rule, not a
// preference: "the function's behaviour, grants, predicates and RLS isolation are
// never mocked — only real Postgres proves that a definer function counts another
// user's rows, that anon is refused, or that a grant landed." Every assertion
// below runs against the real dev Postgres instance (ref `hynwleaxtbtjzkvpjsug`),
// through real `SupabaseClient`s carrying real JWTs for two real seeded users.
// @real-dependency: Postgres (dev), `exam_attempts`, `exams`, `exam_hot_counts()`
//   and its grants/revokes — none of this is mocked; that is the entire point of
//   this lane existing separately from `shelves.int.test.ts`.
//
// -----------------------------------------------------------------------------
// WHY THIS IS THE RESERVED SLOT, NOT an ROI>50 opportunistic pick
// -----------------------------------------------------------------------------
// Per the reserved-slot rule: a service-integration-e2e slot is reserved when the
// journey's correctness depends on real cross-service/cross-boundary behaviour
// that fixture-e2e (mocked backend) cannot verify. A `security definer` function
// crossing another user's `exam_attempts` RLS boundary is EXACTLY that class of
// claim — a mocked `{ from, rpc }` client can assert "the code calls rpc() with
// these arguments" but can never prove that the object it calls (a) actually
// bypasses RLS, (b) actually excludes `anon`, or (c) actually excludes an
// unpublished/banned-author exam once real Postgres evaluates its predicates.
// ROI: 110 (BV:10 x Freq:10 + Legal:0 + Defect:10)
//   BV 10 — a leak here is a real privacy incident (another student's identity or
//     activity crossing a boundary the PRD/ADR both state must stay aggregate-only),
//     not a UX regression.
//   Freq 10 — this ONE RPC underlies every hot-shelf render, every ?sort=hot flat
//     grid, and every home-block render, for every signed-in user — the highest
//     call frequency of any new surface this feature adds.
//   Defect 10 — maximal: no lane other than this one and the manual `test-rls.ts`
//     suite can detect an RLS-bypass or grant defect at all; a mocked test cannot
//     fail this way even when the real function is broken.
// Behavior: two real, distinct, seeded student users (A, B) exist on dev, each
//   with their own `exam_attempts` rows -> A's authenticated client calls
//   `exam_hot_counts(...)` -> the returned row for an exam ONLY B submitted has
//   `total_count >= 1`, proving the aggregate crosses users through a real JWT ->
//   the returned row's key set is exactly the four declared columns, proving no
//   identity/timestamp/score column leaked -> rows for an in_progress attempt, an
//   unpublished exam and a banned author's exam are each absent -> the window
//   boundaries snap to the HOUR server-side, not to the caller's raw argument ->
//   `p_max_rows` clamps against the imported `LIST_ROW_CEILING`/`POSTGREST_MAX_ROWS`
//   constants, not hand-copied literals -> anon gets 42501; service_role gets an
//   array.
// @category: core-functionality
// @lane: service-integration-e2e
// @dependency: full-system (real dev Postgres, real Supabase Auth, real RLS,
//   `public.exam_hot_counts()`) + `examHotCountsFixtures.ts` (not yet created —
//   see note above)
// @complexity: high
// @real-dependency: Postgres (dev, ref hynwleaxtbtjzkvpjsug), exam_attempts, exams,
//   exam_hot_counts() — see Mock Boundary above; nothing in this file may be mocked
// Primary failure mode: the function is deployed without `security definer` (or the
//   grant to `authenticated` is missing/misconfigured), so A's call to
//   `exam_hot_counts` returns 0 rows / a permission error instead of counting B's
//   real submission — the exact failure the backend DD's own Verification Strategy
//   names as "the single assumption the whole feature rests on...checkable in one
//   query", now automated instead of only checked once by hand on dev. The second,
//   subtler failure mode: the returned row carries an extra column (e.g. a
//   `submitted_at` or `user_id` the `returns table` signature was widened to
//   include by mistake) — HS-c is written precisely because "asserting values alone
//   would pass while a column leaked."
// Proof obligation — what the implemented test must assert:
//   (a) HS-b (cross-user proof): with only user B having a submitted attempt on a
//       given exam, user A's authenticated `.rpc("exam_hot_counts", {...})` call
//       returns a row for that exam id with `total_count >= 1` — a mocked client
//       could never fail this way even when the real grant is broken, which is the
//       entire justification for this lane existing;
//   (b) HS-c (the leak proof): for at least one returned row,
//       `Object.keys(row).sort()` is exactly
//       `["exam_id", "recent_count", "total_count", "wide_count"]` — no `user_id`,
//       `submitted_at`, `id` or `total_score` — assert the KEY SET, not just that
//       expected values are present, per the backend DD's own explicit warning;
//   (c) an `in_progress` (not `submitted`) attempt contributes 0 to every count for
//       its exam; an exam whose `exams.status <> 'published'` is absent from the
//       result set entirely, even though it has qualifying submitted attempts; an
//       exam whose author is banned (`auth.admin.updateUserById(..., {
//       ban_duration })`) is absent, then present again once the ban is lifted
//       (mirrors `test-rls.ts` HS-d/HS-f, automated here for CI-adjacent coverage);
//   (d) HOUR-SNAPPED WINDOW BOUNDARIES: seed one attempt 1 second before
//       `date_trunc('hour', p_since_recent)` and one attempt 1 second after it —
//       assert the first is EXCLUDED from `recent_count` and the second is
//       INCLUDED, proving the boundary snaps server-side to the hour of the
//       caller-supplied argument, not to the raw argument itself (the mechanism
//       that stops a JWT holder from bisecting the time axis to localise another
//       student's submission to the second);
//   (e) `p_max_rows` clamp is asserted against the IMPORTED `LIST_ROW_CEILING` /
//       `POSTGREST_MAX_ROWS` constants from `@/lib/supabase/boundedRead`, not
//       against hand-copied literals (501/1000) — a change on either side of that
//       equality must turn this obligation red, per the backend DD's own
//       instruction ("the service e2e clamp case asserts against the imported
//       constants...so a change on either side turns that case red instead of
//       drifting");
//   (f) GRANT BOUNDARY: an anonymous client's call to `exam_hot_counts` resolves
//       with `error.code === "42501"`; a `service_role` client's call resolves with
//       an array and no error (mirrors HS-e).

import { describe, it } from "vitest";

// UNGATED here on purpose (see "HAS_LIVE_DB NOTE" above) — wrap with
// `describe.skipIf(!HAS_LIVE_DB)` once `examHotCountsFixtures.ts` exists.
describe(
  "exam_hot_counts() — real Postgres dev: cross-user count, leak-proof column set, exclusion predicates, hour-snapped windows, row-cap clamp, grant boundary (AC-018, AC-025, AC-027, AC-028)",
  () => {
    it.todo(
      "user A's authenticated call counts an exam only user B submitted (HS-b, obligation a)"
    );
    it.todo(
      "a returned row's key set is exactly {exam_id, recent_count, wide_count, total_count} — no user_id/submitted_at/id/total_score (HS-c, obligation b)"
    );
    it.todo(
      "in_progress attempts, unpublished exams and banned-author exams are excluded; a banned author's exam reappears once the ban is lifted (HS-d/HS-f, obligation c)"
    );
    it.todo(
      "window boundaries snap to the HOUR server-side: an attempt 1s before date_trunc('hour', p_since_recent) is excluded, 1s after is included (obligation d)"
    );
    it.todo(
      "p_max_rows clamps against the imported LIST_ROW_CEILING/POSTGREST_MAX_ROWS constants, not hand-copied literals (obligation e)"
    );
    it.todo("anon gets 42501; service_role gets an array (HS-e, obligation f)");
  }
);
